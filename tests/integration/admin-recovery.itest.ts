import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from 'better-auth/crypto';

import prisma from '@/lib/db';
import { clearAudit } from './db';
import { RecoveryError, recoverAdministrator } from '@/lib/auth/recovery';
import { evaluateAccess } from '@/lib/auth/policy';

const NEW = 'temporary password 12345';

beforeEach(async () => {
  await clearAudit();
  await prisma.authUser.deleteMany();
  await prisma.authUser.create({
    data: {
      id: 'adm',
      email: 'adm@example.test',
      name: 'Adm',
      emailVerified: true,
      disabled: true,
      twoFactorEnabled: true,
      roleAssignments: { create: [{ role: 'ADMIN' }, { role: 'MAINTAINER' }] },
      accounts: { create: { id: 'a', accountId: 'adm', providerId: 'credential', password: await hashPassword('old password 12345') } },
      twoFactor: { create: { id: 'tf', secret: 'x', backupCodes: 'x' } },
      sessions: { create: { id: 's', token: 't', expiresAt: new Date(Date.now() + 3600_000) } },
    },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('operator Administrator recovery', () => {
  it('resets password, removes TOTP, revokes sessions, re-enables, and audits', async () => {
    await recoverAdministrator({ email: 'ADM@example.test', newPassword: NEW });
    const user = await prisma.authUser.findUniqueOrThrow({ where: { id: 'adm' }, include: { accounts: true } });
    expect(user).toMatchObject({ disabled: false, twoFactorEnabled: false });
    expect(await verifyPassword({ hash: user.accounts[0].password!, password: NEW })).toBe(true);
    expect(await prisma.authTwoFactor.count()).toBe(0);
    expect(await prisma.authSession.count()).toBe(0);
    expect(await prisma.authRoleAssignment.count({ where: { userId: 'adm' } })).toBe(2);
    const [event] = await prisma.auditEvent.findMany();
    expect(event).toMatchObject({ action: 'ADMIN_RECOVERED', actorId: null, targetId: 'adm' });
    expect(JSON.stringify(event)).not.toContain(NEW);
  });

  it('grants no protected access until TOTP is re-enrolled', () => {
    const now = new Date();
    const status = evaluateAccess({
      session: { createdAt: now, expiresAt: new Date(now.getTime() + 3600_000), mfaVerified: false },
      user: { disabled: false, twoFactorEnabled: false },
      roles: ['ADMIN'],
      now,
    });
    expect(status).toBe('mfa-enrollment-required');
  });

  it('refuses unknown accounts, non-Administrators and invalid input, changing nothing', async () => {
    await prisma.authUser.create({
      data: { id: 'mnt', email: 'm@example.test', name: 'M', emailVerified: true, roleAssignments: { create: { role: 'MAINTAINER' } } },
    });
    await expect(recoverAdministrator({ email: 'nobody@example.test', newPassword: NEW })).rejects.toBeInstanceOf(RecoveryError);
    await expect(recoverAdministrator({ email: 'm@example.test', newPassword: NEW })).rejects.toBeInstanceOf(RecoveryError);
    await expect(recoverAdministrator({ email: 'adm@example.test', newPassword: 'short' })).rejects.toThrow();
    await expect(recoverAdministrator({ email: 'adm@example.test', newPassword: NEW, extra: 1 })).rejects.toThrow();
    expect(await prisma.authTwoFactor.count()).toBe(1);
    expect(await prisma.auditEvent.count()).toBe(0);
  });
});
