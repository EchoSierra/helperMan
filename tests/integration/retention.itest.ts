import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const actor = vi.hoisted(() => ({ roles: ['ADMIN'] as string[] }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/guards', async () => {
  const { ForbiddenError } = await import('@/lib/auth/errors');
  return {
    requireMaintainer: async () => ({ status: 'granted', roles: actor.roles, userId: 'adm-1' }),
    requireAdministrator: async () => {
      if (!actor.roles.includes('ADMIN')) throw new ForbiddenError();
      return { status: 'granted', roles: actor.roles, userId: 'adm-1' };
    },
  };
});

import prisma from '@/lib/db';
import { clearAudit } from './db';
import { listRetentionPolicies, setRetentionPolicy } from '@/features/retention/service';
import { RetentionPolicyMissingError, runRetention } from '@/lib/retention';
import { updateHelper } from '@/features/helpers/service';
import { ForbiddenError } from '@/lib/auth/errors';

const DAY = 86_400_000;
const NOW = new Date('2026-06-01T12:00:00Z');
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);
const policy = { kind: 'INACTIVE_HELPER', periodDays: 100, decisionReference: 'DPO-2026-04', confirmApproved: 'on' };

beforeEach(async () => {
  actor.roles = ['ADMIN'];
  await clearAudit();
  await prisma.retentionPolicy.deleteMany();
  await prisma.helper.deleteMany();
  await prisma.authUser.deleteMany();
  await prisma.authUser.create({ data: { id: 'adm-1', email: 'a@example.test', name: 'A', emailVerified: true } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('retention schedule maintenance', () => {
  it('records the approving Administrator and audits the change', async () => {
    await setRetentionPolicy(policy);
    await setRetentionPolicy({ ...policy, periodDays: 200 });
    const rows = await listRetentionPolicies();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'INACTIVE_HELPER', periodDays: 200, approvedById: 'adm-1' });
    expect(await prisma.auditEvent.count({ where: { action: 'RETENTION_POLICY_SET', targetId: 'INACTIVE_HELPER' } })).toBe(2);
  });

  it('requires explicit approval, a reference and a positive period', async () => {
    await expect(setRetentionPolicy({ ...policy, confirmApproved: undefined })).rejects.toThrow();
    await expect(setRetentionPolicy({ ...policy, decisionReference: ' ' })).rejects.toThrow();
    await expect(setRetentionPolicy({ ...policy, periodDays: 0 })).rejects.toThrow();
    await expect(setRetentionPolicy({ ...policy, extra: 1 })).rejects.toThrow();
    expect(await prisma.retentionPolicy.count()).toBe(0);
  });

  it('is Administrator-only', async () => {
    actor.roles = ['MAINTAINER'];
    await expect(setRetentionPolicy(policy)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listRetentionPolicies()).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('inactive-helper retention run', () => {
  async function seed() {
    const mk = (id: string, active: boolean, deactivatedAt: Date | null) =>
      prisma.helper.create({
        data: { id, firstName: id, lastName: 'X', active, deactivatedAt, qualifications: { create: { title: 'Q' } } },
      });
    await mk('old', false, ago(150));
    await mk('recent', false, ago(10));
    await mk('active', true, null);
    await setRetentionPolicy(policy);
  }

  it('refuses to run without an approved schedule', async () => {
    await expect(runRetention('INACTIVE_HELPER', { now: NOW })).rejects.toBeInstanceOf(RetentionPolicyMissingError);
  });

  it('is a dry run by default and changes nothing', async () => {
    await seed();
    const result = await runRetention('INACTIVE_HELPER', { now: NOW });
    expect(result).toMatchObject({ dryRun: true, eligible: 1, deleted: 0 });
    expect(await prisma.helper.count()).toBe(3);
  });

  it('hard-deletes only eligible inactive helpers and their qualifications, keeping minimal audit', async () => {
    await seed();
    const result = await runRetention('INACTIVE_HELPER', { now: NOW, confirm: true });
    expect(result).toMatchObject({ dryRun: false, deleted: 1 });
    expect((await prisma.helper.findMany({ select: { id: true } })).map((h) => h.id).sort()).toEqual(['active', 'recent']);
    expect(await prisma.helperQualification.count()).toBe(2);
    const purged = await prisma.auditEvent.findMany({ where: { action: 'HELPER_PURGED' } });
    expect(purged.map((e) => e.targetId)).toEqual(['old']);
    expect(await prisma.auditEvent.count({ where: { action: 'RETENTION_RUN' } })).toBe(1);
  });

  it('starts the clock on deactivation and resets it on reactivation', async () => {
    const { id } = await prisma.helper.create({ data: { firstName: 'A', lastName: 'B' } });
    const change = (active: boolean) =>
      updateHelper({ helperId: id, firstName: 'A', lastName: 'B', email: null, phone: null, address: null, active });
    await change(false);
    const first = (await prisma.helper.findUniqueOrThrow({ where: { id } })).deactivatedAt;
    expect(first).not.toBeNull();
    await change(false);
    expect((await prisma.helper.findUniqueOrThrow({ where: { id } })).deactivatedAt).toEqual(first);
    await change(true);
    expect((await prisma.helper.findUniqueOrThrow({ where: { id } })).deactivatedAt).toBeNull();
  });
});

describe('audit-log retention run', () => {
  it('deletes only events older than the approved period via the trigger opt-in', async () => {
    await setRetentionPolicy({ ...policy, kind: 'AUDIT_LOG', periodDays: 30 });
    await prisma.auditEvent.createMany({
      data: [
        { action: 'HELPER_READ', targetType: 'helper', occurredAt: ago(90) },
        { action: 'HELPER_READ', targetType: 'helper', occurredAt: ago(5) },
      ],
    });
    expect(await runRetention('AUDIT_LOG', { now: NOW })).toMatchObject({ dryRun: true, eligible: 1 });
    expect(await prisma.auditEvent.count({ where: { action: 'HELPER_READ' } })).toBe(2);
    await runRetention('AUDIT_LOG', { now: NOW, confirm: true });
    expect(await prisma.auditEvent.count({ where: { action: 'HELPER_READ' } })).toBe(1);
    expect(await prisma.auditEvent.count({ where: { action: 'AUDIT_EVENTS_PURGED' } })).toBe(1);
  });

  it('stays append-only outside the retention run', async () => {
    await prisma.auditEvent.create({ data: { action: 'HELPER_READ', targetType: 'helper', occurredAt: ago(90) } });
    await expect(prisma.auditEvent.deleteMany()).rejects.toThrow();
  });
});
