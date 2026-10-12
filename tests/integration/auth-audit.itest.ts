import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from 'better-auth/crypto';

import prisma from '@/lib/db';
import { getAuth } from '@/lib/auth/auth';

const PASSWORD = 'correct horse battery';
const HEADERS = () => new Headers({ origin: 'http://localhost:3000', 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250)}` });

const actions = async () =>
  (await prisma.auditEvent.findMany({ orderBy: { occurredAt: 'asc' }, select: { action: true } })).map((e) => e.action);

async function makeUser(opts: { disabled?: boolean } = {}) {
  await prisma.authUser.create({
    data: {
      id: 'u1',
      email: 'u@example.test',
      name: 'U',
      emailVerified: true,
      disabled: opts.disabled ?? false,
      roleAssignments: { create: { role: 'MAINTAINER' } },
      accounts: { create: { id: 'a1', accountId: 'u1', providerId: 'credential', password: await hashPassword(PASSWORD) } },
    },
  });
}

beforeEach(async () => {
  await prisma.auditEvent.deleteMany();
  await prisma.authUser.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('authentication audit events (PostgreSQL, real Better Auth)', () => {
  it('records a wrong-password sign-in as SIGN_IN_FAILED and stores no credentials', async () => {
    await makeUser();
    await expect(
      getAuth().api.signInEmail({ body: { email: 'u@example.test', password: 'wrong wrong wrong' }, headers: HEADERS() }),
    ).rejects.toThrow();
    expect(await actions()).toEqual(['SIGN_IN_FAILED']);
    const [event] = await prisma.auditEvent.findMany();
    expect(JSON.stringify(event)).not.toContain('wrong');
    expect(event.actorId).toBe('u1');
  });

  it('records an unknown email without an actor', async () => {
    await expect(
      getAuth().api.signInEmail({ body: { email: 'nobody@example.test', password: PASSWORD }, headers: HEADERS() }),
    ).rejects.toThrow();
    const [event] = await prisma.auditEvent.findMany();
    expect(event).toMatchObject({ action: 'SIGN_IN_FAILED', actorId: null });
  });

  it('records SIGN_IN_PASSWORD_ACCEPTED and SESSION_STARTED for a valid sign-in', async () => {
    await makeUser();
    await getAuth().api.signInEmail({ body: { email: 'u@example.test', password: PASSWORD }, headers: HEADERS() });
    expect(await actions()).toEqual(expect.arrayContaining(['SIGN_IN_PASSWORD_ACCEPTED', 'SESSION_STARTED']));
    const session = await prisma.authSession.findFirstOrThrow({ where: { userId: 'u1' } });
    expect(session.ipAddress).toBeNull();
    expect(session.userAgent).toBeNull();
  });

  it('blocks a disabled account, audits SIGN_IN_BLOCKED and creates no session', async () => {
    await makeUser({ disabled: true });
    await expect(
      getAuth().api.signInEmail({ body: { email: 'u@example.test', password: PASSWORD }, headers: HEADERS() }),
    ).rejects.toThrow();
    expect(await actions()).toContain('SIGN_IN_BLOCKED');
    expect(await prisma.authSession.count()).toBe(0);
  });
});
