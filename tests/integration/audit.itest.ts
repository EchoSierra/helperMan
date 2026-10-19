import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const actor = vi.hoisted(() => ({ roles: ['MAINTAINER'] as string[] }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/guards', async () => {
  const { ForbiddenError } = await import('@/lib/auth/errors');
  return {
    requireMaintainer: async () => {
      if (!actor.roles.includes('MAINTAINER')) throw new ForbiddenError();
      return { status: 'granted', roles: actor.roles, userId: 'maint-1' };
    },
  };
});

import prisma from '@/lib/db';
import { clearAudit } from './db';
import { listAuditEvents } from '@/features/audit/service';
import { createHelper, getHelperFormData, getHelperProfile, listHelpers } from '@/features/helpers/service';
import { createQualification, listQualificationExpiries } from '@/features/qualifications/service';
import { createQualificationDefinition } from '@/features/qualifications/catalog-service';
import { ForbiddenError } from '@/lib/auth/errors';

const actions = async () => (await prisma.auditEvent.findMany({ select: { action: true } })).map((e) => e.action);

beforeEach(async () => {
  actor.roles = ['MAINTAINER'];
  vi.restoreAllMocks();
  await clearAudit();
  await prisma.helper.deleteMany();
  await prisma.qualificationDefinition.deleteMany();
  await prisma.authUser.deleteMany();
  await prisma.authUser.create({ data: { id: 'maint-1', email: 'm@example.test', name: 'M', emailVerified: true } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Makes the audit insert inside the next read transaction fail. */
function breakAuditWrites() {
  const real = prisma.$transaction.bind(prisma) as (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
  vi.spyOn(prisma, '$transaction').mockImplementation(((fn: (tx: unknown) => Promise<unknown>) =>
    real((tx) =>
      fn(
        new Proxy(tx as object, {
          get: (target, key) =>
            key === 'auditEvent'
              ? {
                  create: () => Promise.reject(new Error('audit down')),
                  createMany: () => Promise.reject(new Error('audit down')),
                }
              : Reflect.get(target, key),
        }),
      ),
    )) as never);
}

describe('audit reads are recorded and fail closed', () => {
  it('records helper, qualification and report reads', async () => {
    const { helperId } = await createHelper({ firstName: 'A', lastName: 'B' });
    await createQualificationDefinition({ name: 'CPR' });
    const definition = await prisma.qualificationDefinition.findFirstOrThrow({ where: { name: 'CPR' } });
    await createQualification({ helperId, definitionId: definition.id, validThrough: '2000-01-01' });
    await clearAudit();

    await listHelpers({});
    await getHelperFormData(helperId);
    await getHelperProfile(helperId);
    await listQualificationExpiries({ afterId: null });
    const got = await actions();
    expect(got).toEqual(
      expect.arrayContaining(['HELPER_READ', 'QUALIFICATION_READ', 'QUALIFICATION_EXPIRY_REPORT_ACCESSED']),
    );
    expect(got.filter((a) => a === 'HELPER_READ').length).toBeGreaterThanOrEqual(4);
  });

  it('returns no data when the audit write fails', async () => {
    const { helperId } = await createHelper({ firstName: 'A', lastName: 'B' });
    await createQualificationDefinition({ name: 'CPR' });
    const definition = await prisma.qualificationDefinition.findFirstOrThrow({ where: { name: 'CPR' } });
    await createQualification({ helperId, definitionId: definition.id, validThrough: '2000-01-01' });
    breakAuditWrites();
    await expect(listHelpers({})).rejects.toThrow('audit down');
    await expect(getHelperProfile(helperId)).rejects.toThrow('audit down');
    await expect(getHelperFormData(helperId)).rejects.toThrow('audit down');
    await expect(listQualificationExpiries({ afterId: null })).rejects.toThrow('audit down');
  });

  it('rolls back a helper write when its audit event cannot be stored', async () => {
    breakAuditWrites();
    await expect(createHelper({ firstName: 'A', lastName: 'B' })).rejects.toThrow('audit down');
    vi.restoreAllMocks();
    expect(await prisma.helper.count()).toBe(0);
  });
});

describe('audit log view', () => {
  it('is denied without the Maintainer role', async () => {
    actor.roles = ['ADMIN'];
    await expect(listAuditEvents({})).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('shows names for existing actors and targets and falls back to ids otherwise', async () => {
    const helper = await prisma.helper.create({ data: { firstName: 'Ada', lastName: 'Lovelace' } });
    await prisma.auditEvent.createMany({
      data: [
        { actorId: 'maint-1', action: 'HELPER_READ', targetType: 'helper', targetId: helper.id, occurredAt: new Date(Date.UTC(2026, 0, 2)) },
        { actorId: 'gone-actor', action: 'HELPER_READ', targetType: 'helper', targetId: 'gone-helper', occurredAt: new Date(Date.UTC(2026, 0, 1)) },
      ],
    });
    const { items } = await listAuditEvents({});
    expect(items[0]).toMatchObject({ targetName: 'Ada Lovelace' });
    expect(items[1]).toMatchObject({ actorName: null, targetName: null });
  });

  it('returns only minimal metadata, newest first, with cursor paging', async () => {
    await prisma.auditEvent.createMany({
      data: Array.from({ length: 55 }, (_, i) => ({
        actorId: 'maint-1',
        action: 'HELPER_READ',
        targetType: 'helper',
        targetId: `h${i}`,
        occurredAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
      })),
    });
    const first = await listAuditEvents({});
    expect(first.items).toHaveLength(50);
    expect(first.items[0].targetId).toBe('h54');
    expect(Object.keys(first.items[0]).sort()).toEqual(['action', 'actorId', 'actorName', 'id', 'newValue', 'occurredAt', 'oldValue', 'targetId', 'targetName', 'targetType']);
    expect(first.items[0]).toMatchObject({ oldValue: null, newValue: null });
    const second = await listAuditEvents({ afterId: first.nextCursor });
    expect(second.items).toHaveLength(5);
    expect(second.nextCursor).toBeNull();
  });

  it('returns approved qualification validity changes in old/new fields', async () => {
    await prisma.auditEvent.create({
      data: {
        actorId: 'maint-1',
        action: 'QUALIFICATION_UPDATED',
        targetType: 'qualification',
        targetId: 'qualification-1',
        oldValue: '2030-01-01',
        newValue: '2031-01-01',
      },
    });
    const page = await listAuditEvents({});
    expect(page.items[0]).toMatchObject({ oldValue: '2030-01-01', newValue: '2031-01-01' });
  });

  it('rejects unknown input', async () => {
    await expect(listAuditEvents({ sql: '1' })).rejects.toThrow();
  });
});
