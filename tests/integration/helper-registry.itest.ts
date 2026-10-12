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
import { createHelper, listHelpers, updateHelper } from '@/features/helpers/service';
import { createQualification, updateQualification } from '@/features/qualifications/service';
import { ForbiddenError } from '@/lib/auth/errors';
import { RecordNotFoundError } from '@/features/helpers/errors';

const actions = async () => (await prisma.auditEvent.findMany({ select: { action: true } })).map((e) => e.action);

beforeEach(async () => {
  actor.roles = ['MAINTAINER'];
  await clearAudit();
  await prisma.helper.deleteMany();
  await prisma.authUser.deleteMany();
  await prisma.authUser.create({
    data: { id: 'maint-1', email: 'm@example.test', name: 'M', emailVerified: true },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('helper registry (PostgreSQL)', () => {
  it('creates and updates a helper with audit events', async () => {
    const { helperId } = await createHelper({ firstName: ' Ada ', lastName: 'Lovelace', email: '', phone: '' });
    const created = await prisma.helper.findUniqueOrThrow({ where: { id: helperId } });
    expect(created).toMatchObject({ firstName: 'Ada', email: null, phone: null, active: true });
    await updateHelper({ helperId, firstName: 'Ada', lastName: 'King', email: null, phone: null, address: null, active: false });
    expect((await prisma.helper.findUniqueOrThrow({ where: { id: helperId } })).active).toBe(false);
    expect(await actions()).toEqual(expect.arrayContaining(['HELPER_CREATED', 'HELPER_UPDATED']));
  });

  it('rejects unknown fields and invalid email', async () => {
    await expect(createHelper({ firstName: 'A', lastName: 'B', admin: true })).rejects.toThrow();
    await expect(createHelper({ firstName: 'A', lastName: 'B', email: 'nope' })).rejects.toThrow();
    expect(await prisma.helper.count()).toBe(0);
  });

  it('denies access without the Maintainer role and writes nothing', async () => {
    actor.roles = ['ADMIN'];
    await expect(createHelper({ firstName: 'A', lastName: 'B' })).rejects.toBeInstanceOf(ForbiddenError);
    expect(await prisma.helper.count()).toBe(0);
    expect(await prisma.auditEvent.count()).toBe(0);
  });

  it('returns not found when updating a missing helper', async () => {
    await expect(
      updateHelper({ helperId: 'missing', firstName: 'A', lastName: 'B', email: null, phone: null, address: null, active: true }),
    ).rejects.toBeInstanceOf(RecordNotFoundError);
  });

  it('searches the directory and paginates with a cursor', async () => {
    for (let i = 0; i < 27; i++) await createHelper({ firstName: `Name${String(i).padStart(2, '0')}`, lastName: 'Zed' });
    const first = await listHelpers({});
    expect(first.items).toHaveLength(25);
    expect(first.nextCursor).not.toBeNull();
    const second = await listHelpers({ cursorId: first.nextCursor });
    expect(second.items).toHaveLength(2);
    const found = await listHelpers({ search: 'Name05' });
    expect(found.items).toHaveLength(1);
  });
});

describe('qualifications (PostgreSQL)', () => {
  it('creates and updates a qualification scoped to its helper', async () => {
    const { helperId } = await createHelper({ firstName: 'A', lastName: 'B' });
    const other = await createHelper({ firstName: 'C', lastName: 'D' });
    const { qualificationId } = await createQualification({ helperId, title: 'First aid', validThrough: '2027-01-31' });
    const row = await prisma.helperQualification.findUniqueOrThrow({ where: { id: qualificationId } });
    expect(row.validThrough?.toISOString().slice(0, 10)).toBe('2027-01-31');

    await expect(
      updateQualification({ helperId: other.helperId, qualificationId, title: 'x', validThrough: '' }),
    ).rejects.toBeInstanceOf(RecordNotFoundError);
    await updateQualification({ helperId, qualificationId, title: 'CPR', validThrough: '' });
    const updated = await prisma.helperQualification.findUniqueOrThrow({ where: { id: qualificationId } });
    expect(updated).toMatchObject({ title: 'CPR', validThrough: null });
    expect(await actions()).toEqual(expect.arrayContaining(['QUALIFICATION_CREATED', 'QUALIFICATION_UPDATED']));
  });

  it('rejects a qualification for a missing helper and cascades on helper delete', async () => {
    await expect(createQualification({ helperId: 'missing', title: 'X', validThrough: '' })).rejects.toBeInstanceOf(
      RecordNotFoundError,
    );
    const { helperId } = await createHelper({ firstName: 'A', lastName: 'B' });
    await createQualification({ helperId, title: 'X', validThrough: '' });
    await prisma.helper.delete({ where: { id: helperId } });
    expect(await prisma.helperQualification.count()).toBe(0);
  });
});
