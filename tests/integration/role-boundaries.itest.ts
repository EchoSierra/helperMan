import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword } from 'better-auth/crypto';

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));

import prisma from '@/lib/db';
import { clearAudit } from './db';
import { totpFromBase32 } from './totp';
import { getAuth } from '@/lib/auth/auth';
import { requireAdministrator, requireMaintainer, requireSession } from '@/lib/auth/guards';
import { ForbiddenError, MfaEnrollmentRequiredError, UnauthenticatedError } from '@/lib/auth/errors';

const PASSWORD = 'correct horse battery';
const ORIGIN = 'http://localhost:3000';
let ip = 0;
const base = () => new Headers({ origin: ORIGIN, 'x-forwarded-for': `10.2.0.${++ip}` });

async function makeUser(roles: Array<'ADMIN' | 'MAINTAINER'>, opts: { disabled?: boolean } = {}) {
  await prisma.authUser.create({
    data: {
      id: 'u1',
      email: 'u@example.test',
      name: 'U',
      emailVerified: true,
      disabled: opts.disabled ?? false,
      roleAssignments: { create: roles.map((role) => ({ role })) },
      accounts: { create: { id: 'a1', accountId: 'u1', providerId: 'credential', password: await hashPassword(PASSWORD) } },
    },
  });
}

const cookieOf = (res: { headers: Headers }) =>
  res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');

/** Password-only session (no TOTP yet). */
async function passwordSession(): Promise<Headers> {
  const res = await getAuth().api.signInEmail({
    body: { email: 'u@example.test', password: PASSWORD },
    headers: base(),
    returnHeaders: true,
  });
  const h = base();
  h.set('cookie', cookieOf(res));
  return h;
}

/** Fully authenticated session: enrol TOTP and verify it. */
async function mfaSession(): Promise<Headers> {
  const first = await passwordSession();
  const enabled = await getAuth().api.enableTwoFactor({ body: { password: PASSWORD }, headers: first });
  if (enabled.method !== 'totp') throw new Error('expected totp');
  const secret = new URL(enabled.totpURI).searchParams.get('secret')!;
  const code = totpFromBase32(secret);
  const res = await getAuth().api.verifyTOTP({ body: { code }, headers: first, returnHeaders: true });
  const h = base();
  h.set('cookie', cookieOf(res) || first.get('cookie')!);
  return h;
}

beforeEach(async () => {
  await clearAudit();
  await prisma.authUser.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('role boundaries with real sessions (PostgreSQL, real guards)', () => {
  it('rejects a request without a session', async () => {
    await expect(requireMaintainer(base())).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it('requires TOTP enrollment before a password-only session may act', async () => {
    await makeUser(['MAINTAINER']);
    await expect(requireMaintainer(await passwordSession())).rejects.toBeInstanceOf(MfaEnrollmentRequiredError);
  });

  it('grants a Maintainer helper access but not account management', async () => {
    await makeUser(['MAINTAINER']);
    const h = await mfaSession();
    await expect(requireMaintainer(h)).resolves.toMatchObject({ userId: 'u1' });
    await expect(requireAdministrator(h)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('grants an Administrator account management but not helper data', async () => {
    await makeUser(['ADMIN']);
    const h = await mfaSession();
    await expect(requireAdministrator(h)).resolves.toMatchObject({ userId: 'u1' });
    await expect(requireMaintainer(h)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('grants both capabilities to an account holding both roles', async () => {
    await makeUser(['ADMIN', 'MAINTAINER']);
    const h = await mfaSession();
    await expect(requireAdministrator(h)).resolves.toBeDefined();
    await expect(requireMaintainer(h)).resolves.toBeDefined();
  });

  it('applies role revocation and account disabling to an existing session immediately', async () => {
    await makeUser(['ADMIN', 'MAINTAINER']);
    const h = await mfaSession();
    await prisma.authRoleAssignment.deleteMany({ where: { userId: 'u1', role: 'MAINTAINER' } });
    await expect(requireMaintainer(h)).rejects.toBeInstanceOf(ForbiddenError);
    await prisma.authUser.update({ where: { id: 'u1' }, data: { disabled: true } });
    await expect(requireSession(h)).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it('denies a session once it is deleted', async () => {
    await makeUser(['MAINTAINER']);
    const h = await mfaSession();
    await prisma.authSession.deleteMany();
    await expect(requireMaintainer(h)).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});
