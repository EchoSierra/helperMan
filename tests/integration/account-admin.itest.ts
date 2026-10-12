import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';


const actor = vi.hoisted(() => ({ userId: 'admin-1' }));
vi.mock('@/lib/auth/guards', () => ({
  requireAdministrator: async () => ({ status: 'granted', roles: ['ADMIN'], userId: actor.userId }),
  requireSession: async () => ({ status: 'granted', roles: ['ADMIN'], userId: actor.userId }),
}));

import prisma from '@/lib/db';
import { clearAudit } from './db';
import {
  createMaintainerAccount,
  deleteMaintainerAccount,
  grantAdminRole,
  revokeAdminRole,
  resetPassword,
  resetTotp,
  revokeMaintainerRole,
  setAccountDisabled,
} from '@/lib/auth/account-admin';
import { ForbiddenError } from '@/lib/auth/errors';

const PASSWORD = 'correct horse battery';

async function reset() {
  await clearAudit();
  await prisma.authSession.deleteMany();
  await prisma.authRoleAssignment.deleteMany();
  await prisma.authTwoFactor.deleteMany();
  await prisma.authAccount.deleteMany();
  await prisma.authUser.deleteMany();
}

async function makeAdmin(id: string, opts: { twoFactor?: boolean } = {}) {
  await prisma.authUser.create({
    data: {
      id,
      email: `${id}@example.test`,
      name: id,
      emailVerified: true,
      twoFactorEnabled: opts.twoFactor ?? true,
      roleAssignments: { create: { role: 'ADMIN' } },
    },
  });
}

async function addSession(userId: string) {
  await prisma.authSession.create({
    data: { id: `s-${userId}`, userId, token: `t-${userId}`, expiresAt: new Date(Date.now() + 3600_000) },
  });
}

const actions = async () => (await prisma.auditEvent.findMany({ select: { action: true } })).map((e) => e.action);

beforeEach(async () => {
  actor.userId = 'admin-1';
  await reset();
  await makeAdmin('admin-1');
});
afterAll(async () => {
  await reset();
  await prisma.$disconnect();
});

describe('account administration (PostgreSQL)', () => {
  it('creates a Maintainer with a hashed credential, fixed role and audit events', async () => {
    const { userId } = await createMaintainerAccount({ email: 'New@Example.test', name: 'New', password: PASSWORD });
    const user = await prisma.authUser.findUnique({
      where: { id: userId },
      include: { accounts: true, roleAssignments: true },
    });
    expect(user?.email).toBe('new@example.test');
    expect(user?.roleAssignments.map((r) => r.role)).toEqual(['MAINTAINER']);
    expect(user?.accounts[0].password).toBeTruthy();
    expect(user?.accounts[0].password).not.toContain(PASSWORD);
    expect((await actions()).sort()).toEqual(['ACCOUNT_CREATED', 'ROLE_GRANTED']);
  });

  it('rolls back the account when the audit write fails', async () => {
    const realTransaction = prisma.$transaction.bind(prisma) as (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
    const spy = vi.spyOn(prisma, '$transaction').mockImplementationOnce(((fn: (tx: unknown) => Promise<unknown>) =>
      realTransaction((tx) =>
        fn(
          new Proxy(tx as object, {
            get: (target, key) =>
              key === 'auditEvent'
                ? { create: () => Promise.reject(new Error('audit down')) }
                : Reflect.get(target, key),
          }),
        ),
      )) as never);
    await expect(
      createMaintainerAccount({ email: 'x@example.test', name: 'X', password: PASSWORD }),
    ).rejects.toThrow('audit down');
    spy.mockRestore();
    expect(await prisma.authUser.count({ where: { email: 'x@example.test' } })).toBe(0);
  });

  it('rejects unknown input fields such as a role', async () => {
    await expect(
      createMaintainerAccount({ email: 'y@example.test', name: 'Y', password: PASSWORD, role: 'ADMIN' }),
    ).rejects.toThrow();
  });

  it('disabling revokes sessions and cannot target oneself', async () => {
    const { userId } = await createMaintainerAccount({ email: 'm@example.test', name: 'M', password: PASSWORD });
    await addSession(userId);
    await setAccountDisabled({ userId }, true);
    expect((await prisma.authUser.findUnique({ where: { id: userId } }))?.disabled).toBe(true);
    expect(await prisma.authSession.count({ where: { userId } })).toBe(0);
    await expect(setAccountDisabled({ userId: 'admin-1' }, true)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('keeps at least two verified Administrators when disabling one', async () => {
    await makeAdmin('admin-2');
    await expect(setAccountDisabled({ userId: 'admin-2' }, true)).rejects.toBeInstanceOf(ForbiddenError);
    await makeAdmin('admin-3');
    await setAccountDisabled({ userId: 'admin-3' }, true);
    expect((await prisma.authUser.findUnique({ where: { id: 'admin-3' } }))?.disabled).toBe(true);
  });

  it('deletes Maintainers only, cascading their data, and never Administrators', async () => {
    const { userId } = await createMaintainerAccount({ email: 'd@example.test', name: 'D', password: PASSWORD });
    await addSession(userId);
    await makeAdmin('admin-2');
    await expect(deleteMaintainerAccount({ userId: 'admin-2' })).rejects.toBeInstanceOf(ForbiddenError);
    await deleteMaintainerAccount({ userId });
    expect(await prisma.authUser.count({ where: { id: userId } })).toBe(0);
    expect(await prisma.authSession.count({ where: { userId } })).toBe(0);
    expect(await prisma.authAccount.count({ where: { userId } })).toBe(0);
    expect(await actions()).toContain('ACCOUNT_DELETED');
  });

  it('promotes an enabled Maintainer to Administrator, keeping the Maintainer role, with an audit event', async () => {
    const { userId } = await createMaintainerAccount({ email: 'p@example.test', name: 'P', password: PASSWORD });
    await addSession(userId);
    await grantAdminRole({ userId });
    const roles = (await prisma.authRoleAssignment.findMany({ where: { userId } })).map((r) => r.role).sort();
    expect(roles).toEqual(['ADMIN', 'MAINTAINER']);
    expect(await prisma.authSession.count({ where: { userId } })).toBe(1);
    expect(await actions()).toContain('ADMIN_ROLE_GRANTED');
    await expect(grantAdminRole({ userId })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('refuses to promote oneself, unknown, disabled or non-Maintainer accounts', async () => {
    await expect(grantAdminRole({ userId: 'admin-1' })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(grantAdminRole({ userId: 'nobody' })).rejects.toBeInstanceOf(ForbiddenError);
    const { userId } = await createMaintainerAccount({ email: 'x@example.test', name: 'X', password: PASSWORD });
    await prisma.authUser.update({ where: { id: userId }, data: { disabled: true } });
    await expect(grantAdminRole({ userId })).rejects.toBeInstanceOf(ForbiddenError);
    await makeAdmin('admin-2');
    await prisma.authRoleAssignment.deleteMany({ where: { userId: 'admin-2', role: 'MAINTAINER' } });
    await expect(grantAdminRole({ userId: 'admin-2' })).rejects.toBeInstanceOf(ForbiddenError);
    expect(await prisma.authRoleAssignment.count({ where: { role: 'ADMIN' } })).toBe(2);
  });

  it('demotes an Administrator back to Maintainer, ends sessions, and keeps two verified Administrators', async () => {
    const { userId } = await createMaintainerAccount({ email: 'm@example.test', name: 'M', password: PASSWORD });
    await prisma.authUser.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
    await grantAdminRole({ userId });
    await addSession(userId);
    // Only two verified Administrators exist (admin-1 and the promoted user).
    await expect(revokeAdminRole({ userId })).rejects.toBeInstanceOf(ForbiddenError);
    await makeAdmin('admin-3');
    await prisma.authRoleAssignment.create({ data: { userId: 'admin-3', role: 'MAINTAINER' } });
    await revokeAdminRole({ userId });
    const roles = (await prisma.authRoleAssignment.findMany({ where: { userId } })).map((r) => r.role);
    expect(roles).toEqual(['MAINTAINER']);
    expect(await prisma.authSession.count({ where: { userId } })).toBe(0);
    expect(await actions()).toContain('ADMIN_ROLE_REVOKED');
    await expect(revokeAdminRole({ userId: 'admin-1' })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('revoking the Maintainer role removes it and ends sessions', async () => {
    const { userId } = await createMaintainerAccount({ email: 'r@example.test', name: 'R', password: PASSWORD });
    await addSession(userId);
    await revokeMaintainerRole({ userId });
    expect(await prisma.authRoleAssignment.count({ where: { userId } })).toBe(0);
    expect(await prisma.authSession.count({ where: { userId } })).toBe(0);
  });

  it('password reset replaces the hash and revokes sessions; unknown users are denied', async () => {
    const { userId } = await createMaintainerAccount({ email: 'p@example.test', name: 'P', password: PASSWORD });
    await addSession(userId);
    const before = (await prisma.authAccount.findFirst({ where: { userId } }))?.password;
    await resetPassword({ userId, newPassword: 'another long password' });
    const after = (await prisma.authAccount.findFirst({ where: { userId } }))?.password;
    expect(after).not.toBe(before);
    expect(await prisma.authSession.count({ where: { userId } })).toBe(0);
    await expect(resetPassword({ userId: 'nobody', newPassword: 'another long password' })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('TOTP reset removes the factor, requires re-enrollment and revokes sessions', async () => {
    const { userId } = await createMaintainerAccount({ email: 't@example.test', name: 'T', password: PASSWORD });
    await prisma.authUser.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
    await prisma.authTwoFactor.create({ data: { id: 'tf-1', userId, secret: 'enc', backupCodes: '' } });
    await addSession(userId);
    await resetTotp({ userId });
    expect(await prisma.authTwoFactor.count({ where: { userId } })).toBe(0);
    expect((await prisma.authUser.findUnique({ where: { id: userId } }))?.twoFactorEnabled).toBe(false);
    expect(await prisma.authSession.count({ where: { userId } })).toBe(0);
    actor.userId = userId;
    await expect(resetTotp({ userId })).rejects.toBeInstanceOf(ForbiddenError);
  });
});
