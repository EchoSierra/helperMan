import { z } from 'zod';
import { hashPassword } from 'better-auth/crypto';
import { randomUUID } from 'node:crypto';
import prisma from '@/lib/db';
import { recordAuditEvent } from './audit';
import { ForbiddenError } from './errors';
import { requireAdministrator } from './guards';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from './policy';

const id = z.string().min(1).max(64);
const password = z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH);

export const createMaintainerSchema = z
  .object({ email: z.email().max(254), name: z.string().trim().min(1).max(200), password })
  .strict();
export const targetSchema = z.object({ userId: id }).strict();
export const resetPasswordSchema = z
  .object({ userId: id, newPassword: password })
  .strict();
export const resetTotpSchema = z.object({ userId: id }).strict();

type Actor = { userId: string };

export function assertNotSelf(actor: Actor, targetId: string) {
  if (actor.userId === targetId) throw new ForbiddenError();
}

async function revokeAllSessions(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], userId: string) {
  await tx.authSession.deleteMany({ where: { userId } });
}

/** Creates a Maintainer. The role is fixed server-side, never taken from input. */
export async function createMaintainerAccount(input: unknown) {
  const actor = await requireAdministrator();
  const data = createMaintainerSchema.parse(input);
  const email = data.email.toLowerCase();
  const passwordHash = await hashPassword(data.password);
  const userId = randomUUID();
  await prisma.$transaction(async (tx) => {
    await tx.authUser.create({
      data: {
        id: userId,
        email,
        name: data.name,
        emailVerified: true,
        accounts: { create: { id: randomUUID(), accountId: userId, providerId: 'credential', password: passwordHash } },
        roleAssignments: { create: { role: 'MAINTAINER', assignedById: actor.userId } },
      },
    });
    await recordAuditEvent({ actorId: actor.userId, action: 'ACCOUNT_CREATED', targetType: 'account', targetId: userId }, tx);
    await recordAuditEvent({ actorId: actor.userId, action: 'ROLE_GRANTED', targetType: 'account', targetId: userId }, tx);
  });
  return { userId };
}

export async function setAccountDisabled(input: unknown, disabled: boolean) {
  const actor = await requireAdministrator();
  const { userId } = targetSchema.parse(input);
  assertNotSelf(actor, userId);
  await prisma.$transaction(async (tx) => {
    const target = await tx.authUser.findUnique({
      where: { id: userId },
      select: {
        disabled: true,
        twoFactorEnabled: true,
        roleAssignments: { where: { role: 'ADMIN' }, select: { id: true } },
      },
    });
    if (!target) throw new ForbiddenError();
    if (disabled && !target.disabled && target.twoFactorEnabled && target.roleAssignments.length > 0) {
      const verifiedAdminCount = await tx.authUser.count({
        where: {
          disabled: false,
          twoFactorEnabled: true,
          roleAssignments: { some: { role: 'ADMIN' } },
        },
      });
      if (verifiedAdminCount <= 2) throw new ForbiddenError();
    }
    await tx.authUser.update({ where: { id: userId }, data: { disabled } });
    if (disabled) await revokeAllSessions(tx, userId);
    await recordAuditEvent(
      { actorId: actor.userId, action: disabled ? 'ACCOUNT_DISABLED' : 'ACCOUNT_ENABLED', targetType: 'account', targetId: userId },
      tx,
    );
  });
}

export async function revokeSessions(input: unknown) {
  const actor = await requireAdministrator();
  const { userId } = targetSchema.parse(input);
  await prisma.$transaction(async (tx) => {
    const target = await tx.authUser.findUnique({ where: { id: userId }, select: { id: true } });
    if (!target) throw new ForbiddenError();
    await revokeAllSessions(tx, userId);
    await recordAuditEvent({ actorId: actor.userId, action: 'SESSIONS_REVOKED', targetType: 'account', targetId: userId }, tx);
  });
}

/** Maintainer accounts only; Administrators are never deletable here. */
export async function deleteMaintainerAccount(input: unknown) {
  const actor = await requireAdministrator();
  const { userId } = targetSchema.parse(input);
  assertNotSelf(actor, userId);
  await prisma.$transaction(async (tx) => {
    const target = await tx.authUser.findUnique({
      where: { id: userId },
      select: { roleAssignments: { select: { role: true } } },
    });
    if (!target || !target.roleAssignments.some((assignment) => assignment.role === 'MAINTAINER')) {
      throw new ForbiddenError();
    }
    if (target.roleAssignments.some((assignment) => assignment.role === 'ADMIN')) throw new ForbiddenError();
    await tx.authUser.delete({ where: { id: userId } });
    await recordAuditEvent({ actorId: actor.userId, action: 'ACCOUNT_DELETED', targetType: 'account', targetId: userId }, tx);
  });
}

export async function grantMaintainerRole(input: unknown) {
  const actor = await requireAdministrator();
  const { userId } = targetSchema.parse(input);
  await prisma.$transaction(async (tx) => {
    await tx.authRoleAssignment.upsert({
      where: { userId_role: { userId, role: 'MAINTAINER' } },
      create: { userId, role: 'MAINTAINER', assignedById: actor.userId },
      update: {},
    });
    await recordAuditEvent({ actorId: actor.userId, action: 'ROLE_GRANTED', targetType: 'account', targetId: userId }, tx);
  });
}

export async function revokeMaintainerRole(input: unknown) {
  const actor = await requireAdministrator();
  const { userId } = targetSchema.parse(input);
  await prisma.$transaction(async (tx) => {
    await tx.authRoleAssignment.deleteMany({ where: { userId, role: 'MAINTAINER' } });
    await revokeAllSessions(tx, userId);
    await recordAuditEvent({ actorId: actor.userId, action: 'ROLE_REVOKED', targetType: 'account', targetId: userId }, tx);
  });
}

/** Promotes an enabled Maintainer to Administrator (the Maintainer role is kept). */
export async function grantAdminRole(input: unknown) {
  const actor = await requireAdministrator();
  const { userId } = targetSchema.parse(input);
  assertNotSelf(actor, userId);
  await prisma.$transaction(async (tx) => {
    const target = await tx.authUser.findUnique({
      where: { id: userId },
      select: { disabled: true, roleAssignments: { select: { role: true } } },
    });
    const roles = target?.roleAssignments.map((assignment) => assignment.role) ?? [];
    if (!target || target.disabled || !roles.includes('MAINTAINER') || roles.includes('ADMIN')) {
      throw new ForbiddenError();
    }
    await tx.authRoleAssignment.create({ data: { userId, role: 'ADMIN', assignedById: actor.userId } });
    await recordAuditEvent({ actorId: actor.userId, action: 'ADMIN_ROLE_GRANTED', targetType: 'account', targetId: userId }, tx);
  });
}

/** Demotes an Administrator who also holds the Maintainer role; never the last verified Administrators. */
export async function revokeAdminRole(input: unknown) {
  const actor = await requireAdministrator();
  const { userId } = targetSchema.parse(input);
  assertNotSelf(actor, userId);
  await prisma.$transaction(async (tx) => {
    const target = await tx.authUser.findUnique({
      where: { id: userId },
      select: { disabled: true, twoFactorEnabled: true, roleAssignments: { select: { role: true } } },
    });
    const roles = target?.roleAssignments.map((assignment) => assignment.role) ?? [];
    if (!target || !roles.includes('ADMIN') || !roles.includes('MAINTAINER')) throw new ForbiddenError();
    if (!target.disabled && target.twoFactorEnabled) {
      const verifiedAdminCount = await tx.authUser.count({
        where: { disabled: false, twoFactorEnabled: true, roleAssignments: { some: { role: 'ADMIN' } } },
      });
      if (verifiedAdminCount <= 2) throw new ForbiddenError();
    }
    await tx.authRoleAssignment.deleteMany({ where: { userId, role: 'ADMIN' } });
    await revokeAllSessions(tx, userId);
    await recordAuditEvent({ actorId: actor.userId, action: 'ADMIN_ROLE_REVOKED', targetType: 'account', targetId: userId }, tx);
  });
}

/** Administrator-assisted password reset after out-of-band identity verification. */
export async function resetPassword(input: unknown) {
  const actor = await requireAdministrator();
  const data = resetPasswordSchema.parse(input);
  assertNotSelf(actor, data.userId);
  const passwordHash = await hashPassword(data.newPassword);
  await prisma.$transaction(async (tx) => {
    const updated = await tx.authAccount.updateMany({
      where: { userId: data.userId, providerId: 'credential' },
      data: { password: passwordHash },
    });
    if (updated.count !== 1) throw new ForbiddenError();
    await revokeAllSessions(tx, data.userId);
    await recordAuditEvent({ actorId: actor.userId, action: 'PASSWORD_RESET', targetType: 'account', targetId: data.userId }, tx);
  });
}

/** Different verified Administrator resets TOTP; target must re-enroll before access. */
export async function resetTotp(input: unknown) {
  const actor = await requireAdministrator();
  const data = resetTotpSchema.parse(input);
  assertNotSelf(actor, data.userId);
  await prisma.$transaction(async (tx) => {
    await tx.authTwoFactor.deleteMany({ where: { userId: data.userId } });
    await tx.authUser.update({ where: { id: data.userId }, data: { twoFactorEnabled: false } });
    await revokeAllSessions(tx, data.userId);
    await recordAuditEvent({ actorId: actor.userId, action: 'TOTP_RESET', targetType: 'account', targetId: data.userId }, tx);
  });
}
