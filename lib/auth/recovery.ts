import { z } from 'zod';
import { hashPassword } from 'better-auth/crypto';
import prisma from '@/lib/db';
import { recordAuditEvent } from './audit';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from './policy';

const recoverySchema = z
  .object({
    email: z.email().max(254),
    newPassword: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
  })
  .strict();

export class RecoveryError extends Error {}

/**
 * Operator break-glass recovery for an existing Administrator when no other
 * verified Administrator can reset them. It never grants access directly: the
 * TOTP factor is removed, every session is revoked, the account is re-enabled
 * with a new temporary password, and TOTP must be re-enrolled before any access.
 * Only callable from the operator script, never from the web app.
 */
export async function recoverAdministrator(input: unknown): Promise<{ userId: string }> {
  const { email, newPassword } = recoverySchema.parse(input);
  const passwordHash = await hashPassword(newPassword);
  return prisma.$transaction(async (tx) => {
    const target = await tx.authUser.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, roleAssignments: { select: { role: true } } },
    });
    if (!target || !target.roleAssignments.some((assignment) => assignment.role === 'ADMIN')) {
      throw new RecoveryError('No Administrator account with that email.');
    }
    const updated = await tx.authAccount.updateMany({
      where: { userId: target.id, providerId: 'credential' },
      data: { password: passwordHash },
    });
    if (updated.count !== 1) throw new RecoveryError('The account has no password credential.');
    await tx.authTwoFactor.deleteMany({ where: { userId: target.id } });
    await tx.authUser.update({ where: { id: target.id }, data: { twoFactorEnabled: false, disabled: false } });
    await tx.authSession.deleteMany({ where: { userId: target.id } });
    await recordAuditEvent({ actorId: null, action: 'ADMIN_RECOVERED', targetType: 'account', targetId: target.id }, tx);
    return { userId: target.id };
  });
}
