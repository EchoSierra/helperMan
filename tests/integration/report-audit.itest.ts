import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/guards', () => ({
  requireMaintainer: async () => ({ status: 'granted', roles: ['MAINTAINER'], userId: 'maint-1' }),
}));

import prisma from '@/lib/db';
import { clearAudit } from './db';
import { exportQualificationExpiries, listQualificationExpiries } from '@/features/qualifications/service';

beforeEach(async () => {
  await clearAudit();
  await prisma.helper.deleteMany();
  await prisma.qualificationDefinition.deleteMany();
  await prisma.authUser.deleteMany();
  await prisma.authUser.create({ data: { id: 'maint-1', email: 'm@example.test', name: 'M', emailVerified: true } });
});

async function definition(name: string) {
  return prisma.qualificationDefinition.create({ data: { name } });
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('qualification expiry report auditing', () => {
  it('records report access plus the helper and qualification reads it exposed', async () => {
    const helper = await prisma.helper.create({ data: { firstName: 'Ada', lastName: 'L' } });
    const soon = new Date(Date.now() + 5 * 86400000);
    const qualificationDefinition = await definition('First aid');
    const q = await prisma.helperQualification.create({
      data: { helperId: helper.id, definitionId: qualificationDefinition.id, validThrough: new Date(Date.UTC(soon.getUTCFullYear(), soon.getUTCMonth(), soon.getUTCDate())) },
    });

    const page = await listQualificationExpiries({ afterId: null });
    expect(page.items).toHaveLength(1);

    const events = await prisma.auditEvent.findMany();
    expect(events.map((e) => `${e.action}:${e.targetId}`).sort()).toEqual(
      [
        `HELPER_READ:${helper.id}`,
        `QUALIFICATION_READ:${q.id}`,
        `QUALIFICATION_DEFINITION_READ:${qualificationDefinition.id}`,
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
    const qualificationDefinition = await definition('Expired');
    await prisma.helperQualification.create({ data: { helperId: helper.id, definitionId: qualificationDefinition.id, validThrough: new Date('2020-01-01') } });
    const real = prisma.$transaction.bind(prisma);
    const spy = vi.spyOn(prisma, '$transaction').mockImplementation(((fn: (tx: unknown) => Promise<unknown>) =>
      real((tx) =>
        fn(new Proxy(tx, { get: (t, k) => (k === 'auditEvent' ? { create: () => Promise.reject(new Error('down')), createMany: () => Promise.reject(new Error('down')) } : Reflect.get(t, k)) })),
      )) as never);
    await expect(listQualificationExpiries({ afterId: null })).rejects.toThrow();
    spy.mockRestore();
    expect(await prisma.auditEvent.count()).toBe(0);
  });

  it('exports all report rows and records a minimal export audit event', async () => {
    const helper = await prisma.helper.create({ data: { firstName: 'Ada', lastName: 'Lovelace', active: false } });
    const qualificationDefinition = await definition('First aid');
    const validThrough = new Date(Date.now() + 5 * 86400000);
    const qualification = await prisma.helperQualification.create({
      data: {
        helperId: helper.id,
        definitionId: qualificationDefinition.id,
        validThrough: new Date(Date.UTC(validThrough.getUTCFullYear(), validThrough.getUTCMonth(), validThrough.getUTCDate())),
      },
    });

    const rows = await exportQualificationExpiries();
    expect(rows).toEqual([expect.objectContaining({
      helperId: helper.id,
      helperName: 'Ada Lovelace',
      helperActive: false,
      qualificationTitle: 'First aid',
    })]);

    const events = await prisma.auditEvent.findMany();
    expect(events.map((event) => `${event.action}:${event.targetId}`)).toContain(
      `QUALIFICATION_EXPIRY_REPORT_EXPORTED:qualification-expiry`,
    );
    expect(events.map((event) => `${event.action}:${event.targetId}`)).toContain(`QUALIFICATION_READ:${qualification.id}`);
    expect(events.every((event) => event.actorId === 'maint-1')).toBe(true);
    expect(events.every((event) => event.targetType !== 'report' || event.targetId === 'qualification-expiry')).toBe(true);
  });

  it('does not return export rows when the export audit event fails', async () => {
    const helper = await prisma.helper.create({ data: { firstName: 'Ada', lastName: 'Lovelace' } });
    const qualificationDefinition = await definition('Expired');
    await prisma.helperQualification.create({ data: { helperId: helper.id, definitionId: qualificationDefinition.id, validThrough: new Date('2020-01-01') } });
    const spy = vi.spyOn(prisma.auditEvent, 'create').mockRejectedValue(new Error('audit unavailable'));

    try {
      await expect(exportQualificationExpiries()).rejects.toThrow('audit unavailable');
    } finally {
      spy.mockRestore();
    }
  });
});
