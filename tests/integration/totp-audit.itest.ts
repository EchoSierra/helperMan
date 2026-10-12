import { createHmac } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from 'better-auth/crypto';

import prisma from '@/lib/db';
import { clearAudit } from './db';
import { getAuth } from '@/lib/auth/auth';

const PASSWORD = 'correct horse battery';
const ORIGIN = 'http://localhost:3000';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function totp(secret: string): string {
  let bits = '';
  for (const c of secret.toUpperCase()) bits += BASE32.indexOf(c).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac('sha1', key).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

const actions = async () =>
  (await prisma.auditEvent.findMany({ orderBy: { occurredAt: 'asc' }, select: { action: true, actorId: true } }));

async function signIn() {
  const res = await getAuth().api.signInEmail({
    body: { email: 'u@example.test', password: PASSWORD },
    headers: new Headers({ origin: ORIGIN, 'x-forwarded-for': `10.1.0.${Math.floor(Math.random() * 250)}` }),
    returnHeaders: true,
  });
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  return new Headers({ origin: ORIGIN, cookie, 'x-forwarded-for': '10.1.1.1' });
}

beforeEach(async () => {
  await clearAudit();
  await prisma.authUser.deleteMany();
  await prisma.authUser.create({
    data: {
      id: 'u1',
      email: 'u@example.test',
      name: 'U',
      emailVerified: true,
      roleAssignments: { create: { role: 'MAINTAINER' } },
      accounts: { create: { id: 'a1', accountId: 'u1', providerId: 'credential', password: await hashPassword(PASSWORD) } },
    },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('TOTP audit events (PostgreSQL, real Better Auth)', () => {
  it('audits enrollment start, failed verification and successful verification without secrets', async () => {
    const headers = await signIn();
    const enabled = await getAuth().api.enableTwoFactor({ body: { password: PASSWORD }, headers });
    if (enabled.method !== 'totp') throw new Error('expected totp');
    const secret = new URL(enabled.totpURI).searchParams.get('secret')!;

    await expect(getAuth().api.verifyTOTP({ body: { code: '000000' }, headers })).rejects.toThrow();
    await getAuth().api.verifyTOTP({ body: { code: totp(secret) }, headers });

    const events = await actions();
    expect(events.map((e) => e.action)).toEqual(
      expect.arrayContaining(['TOTP_ENROLLMENT_STARTED', 'TOTP_VERIFICATION_FAILED', 'TOTP_VERIFIED']),
    );
    for (const e of events.filter((x) => x.action.startsWith('TOTP_'))) expect(e.actorId).toBe('u1');

    const dump = JSON.stringify(await prisma.auditEvent.findMany());
    expect(dump).not.toContain(secret);
    expect(dump).not.toContain('000000');
  });
});
