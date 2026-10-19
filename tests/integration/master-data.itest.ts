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
import {
  DuplicateMasterDataError,
  DuplicateQualificationAssignmentError,
  InvalidAssignmentError,
  InvalidStatusTransitionError,
  RecordNotFoundError,
} from '@/features/helpers/errors';
import { createHelper } from '@/features/helpers/service';
import { createEquipmentItem, createEquipmentType, assignEquipment, assignNewEquipmentToHelper, deleteEquipmentType, listActiveEquipmentTypes, changeEquipmentStatus, listAvailableEquipment, listEquipmentWorkspace, returnEquipment, updateEquipmentType } from '@/features/equipment/service';
import { createQualification, listQualificationExpiries } from '@/features/qualifications/service';
import {
  createQualificationDefinition,
  listQualificationDefinitions,
  updateQualificationDefinition,
} from '@/features/qualifications/catalog-service';
import { ForbiddenError } from '@/lib/auth/errors';

beforeEach(async () => {
  actor.roles = ['MAINTAINER'];
  await clearAudit();
  await prisma.helper.deleteMany();
  await prisma.equipmentItem.deleteMany();
  await prisma.equipmentType.deleteMany();
  await prisma.qualificationDefinition.deleteMany();
  await prisma.authUser.deleteMany();
  await prisma.authUser.create({ data: { id: 'maint-1', email: 'm@example.test', name: 'M', emailVerified: true } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('qualification catalog (PostgreSQL)', () => {
  it('keeps an independent expiry date per assignment and preserves retired definitions', async () => {
    await createQualificationDefinition({ name: 'First aid', category: 'Safety' });
    const definition = await prisma.qualificationDefinition.findFirstOrThrow({ where: { name: 'First aid' } });
    const first = await createHelper({ firstName: 'Ada', lastName: 'A' });
    const second = await createHelper({ firstName: 'Bea', lastName: 'B' });
    const { qualificationId } = await createQualification({
      helperId: first.helperId,
      definitionId: definition.id,
      validThrough: '2026-10-20',
    });
    await createQualification({
      helperId: second.helperId,
      definitionId: definition.id,
      validThrough: '2026-10-25',
    });
    await expect(
      createQualification({ helperId: first.helperId, definitionId: definition.id, validThrough: '' }),
    ).rejects.toBeInstanceOf(DuplicateQualificationAssignmentError);

    await updateQualificationDefinition({
      definitionId: definition.id,
      name: definition.name,
      category: definition.category,
      retired: true,
    });
    const report = await listQualificationExpiries({ afterId: null });
    expect(report.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ helperId: first.helperId, qualificationTitle: 'First aid', validThrough: '2026-10-20' }),
      expect.objectContaining({ helperId: second.helperId, qualificationTitle: 'First aid', validThrough: '2026-10-25' }),
    ]));
    expect(await prisma.helperQualification.findUnique({ where: { id: qualificationId } })).not.toBeNull();
    await expect(
      createQualification({ helperId: first.helperId, definitionId: definition.id, validThrough: '' }),
    ).rejects.toBeInstanceOf(InvalidAssignmentError);
  });

  it('rejects duplicate names and audits catalog reads', async () => {
    await createQualificationDefinition({ name: 'First aid' });
    await expect(createQualificationDefinition({ name: ' first AID ' })).rejects.toBeInstanceOf(DuplicateMasterDataError);
    const entries = await listQualificationDefinitions();
    expect(entries).toHaveLength(1);
    expect(await prisma.auditEvent.count({ where: { action: 'QUALIFICATION_DEFINITION_READ' } })).toBe(1);
    actor.roles = [];
    await expect(listQualificationDefinitions()).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('fails closed when a catalog read cannot be audited', async () => {
    await createQualificationDefinition({ name: 'First aid' });
    const real = prisma.$transaction.bind(prisma);
    const spy = vi.spyOn(prisma, '$transaction').mockImplementation(((fn: (tx: unknown) => Promise<unknown>) =>
      real((tx) =>
        fn(new Proxy(tx as object, {
          get: (target, key) =>
            key === 'auditEvent'
              ? { createMany: () => Promise.reject(new Error('audit unavailable')) }
              : Reflect.get(target, key),
        })),
      )) as never);
    await expect(listQualificationDefinitions()).rejects.toThrow('audit unavailable');
    spy.mockRestore();
  });
});

describe('equipment master data and assignments (PostgreSQL)', () => {
  it('deletes a type together with its items and assignments', async () => {
    await createEquipmentType({ name: 'Mop' });
    const type = await prisma.equipmentType.findFirstOrThrow({ where: { name: 'Mop' } });
    const helper = await createHelper({ firstName: 'Di', lastName: 'D' });
    await assignNewEquipmentToHelper({ equipmentTypeId: type.id, assetLabel: 'M-1', helperId: helper.helperId });
    await createEquipmentItem({ equipmentTypeId: type.id, assetLabel: 'M-2' });
    await deleteEquipmentType({ typeId: type.id });
    expect(await prisma.equipmentType.count({ where: { id: type.id } })).toBe(0);
    expect(await prisma.equipmentItem.count({ where: { equipmentTypeId: type.id } })).toBe(0);
    expect(await prisma.equipmentAssignment.count({ where: { helperId: helper.helperId } })).toBe(0);
    await expect(deleteEquipmentType({ typeId: type.id })).rejects.toBeInstanceOf(RecordNotFoundError);
  });

  it('assigns a new item of a type directly to a helper', async () => {
    await createEquipmentType({ name: 'Ladder' });
    const type = await prisma.equipmentType.findFirstOrThrow({ where: { name: 'Ladder' } });
    const helper = await createHelper({ firstName: 'Cy', lastName: 'C' });
    expect(await listActiveEquipmentTypes()).toEqual([{ id: type.id, name: 'Ladder' }]);
    await assignNewEquipmentToHelper({ equipmentTypeId: type.id, assetLabel: 'L-1', helperId: helper.helperId });
    const item = await prisma.equipmentItem.findFirstOrThrow({ where: { equipmentTypeId: type.id } });
    expect(item).toMatchObject({ assetLabel: 'L-1', status: 'ASSIGNED' });
    expect(await prisma.equipmentAssignment.count({ where: { equipmentItemId: item.id, helperId: helper.helperId, returnedAt: null } })).toBe(1);
    await updateEquipmentType({ typeId: type.id, name: 'Ladder', retired: true });
    await expect(assignNewEquipmentToHelper({ equipmentTypeId: type.id, assetLabel: null, helperId: helper.helperId })).rejects.toBeInstanceOf(InvalidAssignmentError);
  });

  it('enforces lifecycle and single-current-assignment rules', async () => {
    await createEquipmentType({ name: 'Vacuum' });
    const type = await prisma.equipmentType.findFirstOrThrow({ where: { name: 'Vacuum' } });
    await createEquipmentItem({ equipmentTypeId: type.id, assetLabel: 'V-01' });
    const item = await prisma.equipmentItem.findFirstOrThrow({ where: { equipmentTypeId: type.id } });
    const helper = await createHelper({ firstName: 'Ada', lastName: 'A' });
    const other = await createHelper({ firstName: 'Bea', lastName: 'B' });

    expect(await listAvailableEquipment()).toEqual([
      { id: item.id, assetLabel: 'V-01', equipmentTypeName: 'Vacuum' },
    ]);
    await updateEquipmentType({ typeId: type.id, name: type.name, retired: true });
    await expect(createEquipmentItem({ equipmentTypeId: type.id, assetLabel: 'V-02' })).rejects.toBeInstanceOf(InvalidAssignmentError);
    await assignEquipment({ itemId: item.id, helperId: helper.helperId });
    expect(await listAvailableEquipment()).toEqual([]);
    await expect(assignEquipment({ itemId: item.id, helperId: other.helperId })).rejects.toBeInstanceOf(InvalidAssignmentError);
    expect(await prisma.equipmentAssignment.count({ where: { equipmentItemId: item.id, returnedAt: null } })).toBe(1);
    await expect(prisma.equipmentAssignment.create({
      data: { equipmentItemId: item.id, helperId: other.helperId },
    })).rejects.toMatchObject({ code: 'P2002' });
    expect((await listEquipmentWorkspace()).types[0]?.items[0]?.currentAssignment?.helperId).toBe(helper.helperId);

    await returnEquipment({ itemId: item.id });
    expect(await prisma.equipmentAssignment.count({ where: { equipmentItemId: item.id, returnedAt: null } })).toBe(0);
    await changeEquipmentStatus({ itemId: item.id, status: 'IN_REPAIR' });
    await expect(assignEquipment({ itemId: item.id, helperId: helper.helperId })).rejects.toBeInstanceOf(InvalidAssignmentError);
    await changeEquipmentStatus({ itemId: item.id, status: 'AVAILABLE' });
    await changeEquipmentStatus({ itemId: item.id, status: 'RETIRED' });
    await expect(changeEquipmentStatus({ itemId: item.id, status: 'AVAILABLE' })).rejects.toBeInstanceOf(InvalidStatusTransitionError);
    await expect(assignEquipment({ itemId: item.id, helperId: helper.helperId })).rejects.toBeInstanceOf(InvalidAssignmentError);
    expect(await prisma.auditEvent.count({ where: { action: 'EQUIPMENT_ASSIGNED' } })).toBe(1);
    expect(await prisma.auditEvent.count({ where: { action: 'EQUIPMENT_RETURNED' } })).toBe(1);
  });

  it('rolls back equipment writes when the audit insert fails', async () => {
    const real = prisma.$transaction.bind(prisma);
    const spy = vi.spyOn(prisma, '$transaction').mockImplementation(((fn: (tx: unknown) => Promise<unknown>) =>
      real((tx) =>
        fn(new Proxy(tx as object, {
          get: (target, key) =>
            key === 'auditEvent'
              ? { create: () => Promise.reject(new Error('audit unavailable')) }
              : Reflect.get(target, key),
        })),
      )) as never);
    await expect(createEquipmentType({ name: 'Roll back' })).rejects.toThrow('audit unavailable');
    spy.mockRestore();
    expect(await prisma.equipmentType.count({ where: { name: 'Roll back' } })).toBe(0);
  });
});
