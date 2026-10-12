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
import { ForbiddenError } from '@/lib/auth/errors';

const actions = async () => (await prisma.auditEvent.findMany({ select: { action: true } })).map((e) => e.action);

beforeEach(async () => {
  actor.roles = ['MAINTAINER'];
  vi.restoreAllMocks();
  await clearAudit();
  await prisma.helper.deleteMany();
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
    await createQualification({ helperId, title: 'CPR', validThrough: '2000-01-01' });
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
    await createQualification({ helperId, title: 'CPR', validThrough: '2000-01-01' });
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
    expect(Object.keys(first.items[0]).sort()).toEqual(['action', 'actorId', 'id', 'occurredAt', 'targetId', 'targetType']);
    const second = await listAuditEvents({ afterId: first.nextCursor });
    expect(second.items).toHaveLength(5);
    expect(second.nextCursor).toBeNull();
  });

  it('rejects unknown input', async () => {
    await expect(listAuditEvents({ sql: '1' })).rejects.toThrow();
  });
});
