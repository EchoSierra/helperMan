import { z } from 'zod';
import { hashPassword, symmetricDecrypt, verifyPassword } from 'better-auth/crypto';
import { createOTP } from '@better-auth/utils/otp';
import { getAuth } from './auth';
import prisma from '@/lib/db';
import { recordAuditEvent } from './audit';
import { ForbiddenError } from './errors';
import { requireSession } from './guards';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from './policy';

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(MAX_PASSWORD_LENGTH),
    code: z.string().regex(/^[0-9]{6}$/),
    newPassword: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
  })
  .strict()
  .refine((value) => value.currentPassword !== value.newPassword);

const MAX_FAILED_CODES = 5;
const LOCK_MS = 15 * 60 * 1000;

async function verifySecondFactor(userId: string, code: string): Promise<boolean> {
  const factor = await prisma.authTwoFactor.findUnique({
    where: { userId },
    select: { secret: true, failedVerificationCount: true, lockedUntil: true },
  });
  if (!factor) return false;
  if (factor.lockedUntil && factor.lockedUntil.getTime() > Date.now()) return false;
  const { secretConfig } = await (await getAuth().$context);
  const secret = await symmetricDecrypt({ key: secretConfig, data: factor.secret });
  const valid = await createOTP(secret, { digits: 6, period: 30 }).verify(code);
  if (valid) {
    await prisma.authTwoFactor.update({ where: { userId }, data: { failedVerificationCount: 0, lockedUntil: null } });
    return true;
  }
  const failures = (factor.failedVerificationCount ?? 0) + 1;
  await prisma.authTwoFactor.update({
    where: { userId },
    data: failures >= MAX_FAILED_CODES
      ? { failedVerificationCount: 0, lockedUntil: new Date(Date.now() + LOCK_MS) }
      : { failedVerificationCount: failures },
  });
  return false;
}

/** Self-service password change; revokes every session so the user must sign in again. */
export async function changeOwnPassword(input: unknown) {
  const actor = await requireSession();
  const data = changePasswordSchema.parse(input);
  const account = await prisma.authAccount.findFirst({
    where: { userId: actor.userId, providerId: 'credential' },
    select: { id: true, password: true },
  });
  if (!account?.password || !(await verifyPassword({ hash: account.password, password: data.currentPassword }))) {
    throw new ForbiddenError();
  }
  if (!(await verifySecondFactor(actor.userId, data.code))) throw new ForbiddenError();
  const passwordHash = await hashPassword(data.newPassword);
  await prisma.$transaction(async (tx) => {
    await tx.authAccount.update({ where: { id: account.id }, data: { password: passwordHash } });
    await tx.authSession.deleteMany({ where: { userId: actor.userId } });
    await recordAuditEvent(
      { actorId: actor.userId, action: 'PASSWORD_CHANGED', targetType: 'account', targetId: actor.userId },
      tx,
    );
  });
}
