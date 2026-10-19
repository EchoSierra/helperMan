import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword, symmetricEncrypt, verifyPassword } from 'better-auth/crypto';
import { createOTP } from '@better-auth/utils/otp';

const actor = vi.hoisted(() => ({ userId: 'user-1' }));
vi.mock('@/lib/auth/guards', () => ({
  requireSession: async () => ({ status: 'granted', roles: ['MAINTAINER'], userId: actor.userId }),
}));

import prisma from '@/lib/db';
import { clearAudit } from './db';
import { getAuth } from '@/lib/auth/auth';
import { changeOwnPassword } from '@/lib/auth/account-self';
import { ForbiddenError } from '@/lib/auth/errors';

const OLD = 'old password 12345';
const NEW = 'brand new password 678';
const TOTP_SECRET = 'JBSWY3DPEHPK3PXP';

const validCode = () => createOTP(TOTP_SECRET, { digits: 6, period: 30 }).totp();
const wrongCode = async () => {
  const good = await validCode();
  return good === '000000' ? '111111' : '000000';
};
const attempt = (overrides: Record<string, string> = {}, code?: string) =>
  changeOwnPassword({ currentPassword: OLD, newPassword: NEW, code: code ?? '000000', ...overrides });

beforeEach(async () => {
  actor.userId = 'user-1';
  await clearAudit();
  await prisma.authUser.deleteMany();
  const { secretConfig } = await getAuth().$context;
  await prisma.authUser.create({
    data: {
      id: 'user-1',
      email: 'u@example.test',
      name: 'U',
      emailVerified: true,
      twoFactorEnabled: true,
      roleAssignments: { create: { role: 'MAINTAINER' } },
      accounts: {
        create: { id: 'acc-1', accountId: 'user-1', providerId: 'credential', password: await hashPassword(OLD) },
      },
      twoFactor: {
        create: { id: 'tf-1', secret: await symmetricEncrypt({ key: secretConfig, data: TOTP_SECRET }), backupCodes: '[]' },
      },
      sessions: {
        create: [{ id: 's1', token: 't1', expiresAt: new Date(Date.now() + 3600_000) }],
      },
    },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

const stored = async () => (await prisma.authAccount.findUniqueOrThrow({ where: { id: 'acc-1' } })).password!;

describe('changeOwnPassword (PostgreSQL)', () => {
  it('changes the password, revokes sessions and audits with a valid current password and TOTP', async () => {
    await attempt({}, await validCode());
    expect(await verifyPassword({ hash: await stored(), password: NEW })).toBe(true);
    expect(await prisma.authSession.count({ where: { userId: 'user-1' } })).toBe(0);
    const events = await prisma.auditEvent.findMany();
    expect(events.map((e) => e.action)).toEqual(['PASSWORD_CHANGED']);
  });

  it('rejects a wrong TOTP code without changing anything', async () => {
    await expect(attempt({}, await wrongCode())).rejects.toBeInstanceOf(ForbiddenError);
    expect(await verifyPassword({ hash: await stored(), password: OLD })).toBe(true);
    expect(await prisma.authSession.count()).toBe(1);
    expect((await prisma.authTwoFactor.findUniqueOrThrow({ where: { userId: 'user-1' } })).failedVerificationCount).toBe(1);
  });

  it('rejects a wrong current password even with a valid code', async () => {
    await expect(attempt({ currentPassword: 'not the password' }, await validCode())).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(await verifyPassword({ hash: await stored(), password: OLD })).toBe(true);
  });

  it('locks the factor after 5 wrong codes, even for a later valid code', async () => {
    const bad = await wrongCode();
    for (let i = 0; i < 5; i++) await expect(attempt({}, bad)).rejects.toBeInstanceOf(ForbiddenError);
    const factor = await prisma.authTwoFactor.findUniqueOrThrow({ where: { userId: 'user-1' } });
    expect(factor.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    await expect(attempt({}, await validCode())).rejects.toBeInstanceOf(ForbiddenError);
    expect(await verifyPassword({ hash: await stored(), password: OLD })).toBe(true);
  });

  it('resets the failure counter after a successful verification', async () => {
    await expect(attempt({}, await wrongCode())).rejects.toBeInstanceOf(ForbiddenError);
    await attempt({}, await validCode());
    expect((await prisma.authTwoFactor.findUniqueOrThrow({ where: { userId: 'user-1' } })).failedVerificationCount).toBe(0);
  });

  it('rejects malformed input and an unchanged password before touching data', async () => {
    await expect(attempt({}, '12345')).rejects.toThrow();
    await expect(attempt({ newPassword: OLD }, await validCode())).rejects.toThrow();
    await expect(attempt({ newPassword: 'short' }, await validCode())).rejects.toThrow();
    expect(await verifyPassword({ hash: await stored(), password: OLD })).toBe(true);
  });

  it('denies a user without an enrolled authenticator', async () => {
    await prisma.authTwoFactor.deleteMany();
    await expect(attempt({}, await validCode())).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('password change auditing', () => {
  it('records a failed attempt without any secret material', async () => {
    await expect(attempt({}, await wrongCode())).rejects.toBeInstanceOf(ForbiddenError);
    await expect(attempt({ currentPassword: 'nope' }, await validCode())).rejects.toBeInstanceOf(ForbiddenError);
    const events = await prisma.auditEvent.findMany();
    expect(events.map((e) => e.action)).toEqual(['PASSWORD_CHANGE_FAILED', 'PASSWORD_CHANGE_FAILED']);
    expect(Object.keys(events[0]).sort()).toEqual(['action', 'actorId', 'id', 'newValue', 'occurredAt', 'oldValue', 'targetId', 'targetType']);
    expect(events[0]).toMatchObject({ oldValue: null, newValue: null });
  });
});
