import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/guards', () => ({
  requireMaintainer: async () => ({ status: 'granted', roles: ['MAINTAINER'], userId: 'maint-1' }),
}));

import prisma from '@/lib/db';
import { clearAudit } from './db';
import { listQualificationExpiries } from '@/features/qualifications/service';

beforeEach(async () => {
  await clearAudit();
  await prisma.helper.deleteMany();
  await prisma.authUser.deleteMany();
  await prisma.authUser.create({ data: { id: 'maint-1', email: 'm@example.test', name: 'M', emailVerified: true } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('qualification expiry report auditing', () => {
  it('records report access plus the helper and qualification reads it exposed', async () => {
    const helper = await prisma.helper.create({ data: { firstName: 'Ada', lastName: 'L' } });
    const soon = new Date(Date.now() + 5 * 86400000);
    const q = await prisma.helperQualification.create({
      data: { helperId: helper.id, title: 'First aid', validThrough: new Date(Date.UTC(soon.getUTCFullYear(), soon.getUTCMonth(), soon.getUTCDate())) },
    });

    const page = await listQualificationExpiries({ afterId: null });
    expect(page.items).toHaveLength(1);

    const events = await prisma.auditEvent.findMany();
    expect(events.map((e) => `${e.action}:${e.targetId}`).sort()).toEqual(
      [
        `HELPER_READ:${helper.id}`,
        `QUALIFICATION_READ:${q.id}`,
        'QUALIFICATION_EXPIRY_REPORT_ACCESSED:qualification-expiry',
      ].sort(),
    );
    expect(events.every((e) => e.actorId === 'maint-1')).toBe(true);
  });

  it('still audits report access when nothing is due', async () => {
    await listQualificationExpiries({ afterId: null });
    expect((await prisma.auditEvent.findMany()).map((e) => e.action)).toEqual(['QUALIFICATION_EXPIRY_REPORT_ACCESSED']);
  });

  it('returns no data when the audit write fails (fail closed)', async () => {
    const helper = await prisma.helper.create({ data: { firstName: 'Ada', lastName: 'L' } });
    await prisma.helperQualification.create({ data: { helperId: helper.id, title: 'Expired', validThrough: new Date('2020-01-01') } });
    const real = prisma.$transaction.bind(prisma);
    const spy = vi.spyOn(prisma, '$transaction').mockImplementation(((fn: (tx: unknown) => Promise<unknown>) =>
      real((tx) =>
        fn(new Proxy(tx, { get: (t, k) => (k === 'auditEvent' ? { create: () => Promise.reject(new Error('down')), createMany: () => Promise.reject(new Error('down')) } : Reflect.get(t, k)) })),
      )) as never);
    await expect(listQualificationExpiries({ afterId: null })).rejects.toThrow();
    spy.mockRestore();
    expect(await prisma.auditEvent.count()).toBe(0);
  });
});
