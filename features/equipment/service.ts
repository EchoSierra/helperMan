import 'server-only';
import { EquipmentStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/db';
import { requireMaintainer } from '@/lib/auth/guards';
import { recordAuditEvent, recordAuditEvents } from '@/lib/auth/audit';
import {
  DuplicateMasterDataError,
  InvalidAssignmentError,
  InvalidStatusTransitionError,
  RecordNotFoundError,
} from '@/features/helpers/errors';
import { equipmentItemFormSchema, equipmentStatusSchema, equipmentTypeSchema } from '@/features/helpers/schemas';

const idSchema = z.string().trim().min(1).max(64);
const assignmentSchema = z.object({ itemId: idSchema, helperId: idSchema }).strict();
const itemIdSchema = z.object({ itemId: idSchema }).strict();

export type EquipmentItemView = {
  id: string;
  assetLabel: string | null;
  status: EquipmentStatus;
  equipmentTypeId: string;
  equipmentTypeName: string;
  typeRetired: boolean;
  currentAssignment: null | {
    id: string;
    helperId: string;
    helperName: string;
  };
};

export type EquipmentTypeView = {
  id: string;
  name: string;
  retired: boolean;
  items: EquipmentItemView[];
};

export type EquipmentHelperOption = { id: string; name: string };
export type AvailableEquipmentOption = {
  id: string;
  assetLabel: string | null;
  equipmentTypeName: string;
};

async function assertTypeNameAvailable(tx: Prisma.TransactionClient, name: string, exceptId?: string) {
  const existing = await tx.equipmentType.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (existing) throw new DuplicateMasterDataError();
}

function mapUniqueError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new DuplicateMasterDataError();
  }
  throw error;
}

export async function listEquipmentWorkspace(): Promise<{
  types: EquipmentTypeView[];
  helpers: EquipmentHelperOption[];
}> {
  const actor = await requireMaintainer();
  return prisma.$transaction(async (tx) => {
    const [typeRows, helperRows] = await Promise.all([
      tx.equipmentType.findMany({
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          name: true,
          retired: true,
          items: {
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            select: {
              id: true,
              assetLabel: true,
              status: true,
              assignments: {
                where: { returnedAt: null },
                select: {
                  id: true,
                  helperId: true,
                  helper: { select: { id: true, firstName: true, lastName: true } },
                },
              },
            },
          },
        },
      }),
      tx.helper.findMany({
        where: { active: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
        select: { id: true, firstName: true, lastName: true },
      }),
    ]);
    const events = typeRows.flatMap((type) => [
      {
        actorId: actor.userId,
        action: 'EQUIPMENT_TYPE_READ' as const,
        targetType: 'equipment_type' as const,
        targetId: type.id,
      },
      ...type.items.flatMap((item) => [
        {
          actorId: actor.userId,
          action: 'EQUIPMENT_ITEM_READ' as const,
          targetType: 'equipment_item' as const,
          targetId: item.id,
        },
        ...item.assignments.flatMap((assignment) => [
          {
            actorId: actor.userId,
            action: 'EQUIPMENT_ASSIGNMENT_READ' as const,
            targetType: 'equipment_assignment' as const,
            targetId: assignment.id,
          },
          {
            actorId: actor.userId,
            action: 'HELPER_READ' as const,
            targetType: 'helper' as const,
            targetId: assignment.helper.id,
          },
        ]),
      ]),
    ]);
    await recordAuditEvents(
      [
        ...events,
        ...helperRows.map(({ id }) => ({
          actorId: actor.userId,
          action: 'HELPER_READ' as const,
          targetType: 'helper' as const,
          targetId: id,
        })),
      ],
      tx,
    );
    return {
      types: typeRows.map((type) => ({
        id: type.id,
        name: type.name,
        retired: type.retired,
        items: type.items.map((item) => ({
          id: item.id,
          assetLabel: item.assetLabel,
          status: item.status,
          equipmentTypeId: type.id,
          equipmentTypeName: type.name,
          typeRetired: type.retired,
          currentAssignment: item.assignments[0]
            ? {
                id: item.assignments[0].id,
                helperId: item.assignments[0].helperId,
                helperName: `${item.assignments[0].helper.firstName} ${item.assignments[0].helper.lastName}`,
              }
            : null,
        })),
      })),
      helpers: helperRows.map(({ id, firstName, lastName }) => ({
        id,
        name: `${firstName} ${lastName}`,
      })),
    };
  });
}

export async function listAvailableEquipment(): Promise<AvailableEquipmentOption[]> {
  const actor = await requireMaintainer();
  return prisma.$transaction(async (tx) => {
    const items = await tx.equipmentItem.findMany({
      where: { status: EquipmentStatus.AVAILABLE },
      orderBy: [
        { equipmentType: { name: 'asc' } },
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
      select: {
        id: true,
        assetLabel: true,
        equipmentType: { select: { id: true, name: true } },
      },
    });
    await recordAuditEvents(
      items.flatMap(({ id, equipmentType }) => [
        {
          actorId: actor.userId,
          action: 'EQUIPMENT_ITEM_READ' as const,
          targetType: 'equipment_item' as const,
          targetId: id,
        },
        {
          actorId: actor.userId,
          action: 'EQUIPMENT_TYPE_READ' as const,
          targetType: 'equipment_type' as const,
          targetId: equipmentType.id,
        },
      ]),
      tx,
    );
    return items.map(({ id, assetLabel, equipmentType }) => ({
      id,
      assetLabel,
      equipmentTypeName: equipmentType.name,
    }));
  });
}

export type ActiveEquipmentTypeOption = { id: string; name: string };

export async function listActiveEquipmentTypes(): Promise<ActiveEquipmentTypeOption[]> {
  const actor = await requireMaintainer();
  return prisma.$transaction(async (tx) => {
    const types = await tx.equipmentType.findMany({
      where: { retired: false },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true },
    });
    await recordAuditEvents(
      types.map(({ id }) => ({
        actorId: actor.userId,
        action: 'EQUIPMENT_TYPE_READ' as const,
        targetType: 'equipment_type' as const,
        targetId: id,
      })),
      tx,
    );
    return types;
  });
}

export async function createEquipmentType(input: unknown): Promise<void> {
  const data = equipmentTypeSchema.parse(input);
  const actor = await requireMaintainer();
  try {
    await prisma.$transaction(async (tx) => {
      await assertTypeNameAvailable(tx, data.name);
      const type = await tx.equipmentType.create({ data, select: { id: true } });
      await recordAuditEvent(
        { actorId: actor.userId, action: 'EQUIPMENT_TYPE_CREATED', targetType: 'equipment_type', targetId: type.id },
        tx,
      );
    });
  } catch (error) {
    mapUniqueError(error);
  }
}

export async function updateEquipmentType(input: unknown): Promise<void> {
  const data = equipmentTypeSchema
    .extend({ typeId: idSchema, retired: z.boolean() })
    .strict()
    .parse(input);
  const actor = await requireMaintainer();
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.equipmentType.findUnique({
        where: { id: data.typeId },
        select: { retired: true },
      });
      if (!existing) throw new RecordNotFoundError();
      await assertTypeNameAvailable(tx, data.name, data.typeId);
      await tx.equipmentType.update({
        where: { id: data.typeId },
        data: { name: data.name, retired: data.retired },
      });
      await recordAuditEvent(
        {
          actorId: actor.userId,
          action: !existing.retired && data.retired ? 'EQUIPMENT_TYPE_RETIRED' : 'EQUIPMENT_TYPE_UPDATED',
          targetType: 'equipment_type',
          targetId: data.typeId,
        },
        tx,
      );
    });
  } catch (error) {
    mapUniqueError(error);
  }
}

export async function deleteEquipmentType(input: unknown): Promise<void> {
  const { typeId } = z.object({ typeId: idSchema }).strict().parse(input);
  const actor = await requireMaintainer();
  await prisma.$transaction(async (tx) => {
    const [type] = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "equipment_types" WHERE "id" = ${typeId} FOR UPDATE
    `;
    if (!type) throw new RecordNotFoundError();
    await tx.equipmentAssignment.deleteMany({ where: { equipmentItem: { equipmentTypeId: typeId } } });
    await tx.equipmentItem.deleteMany({ where: { equipmentTypeId: typeId } });
    await tx.equipmentType.delete({ where: { id: typeId } });
    await recordAuditEvent(
      { actorId: actor.userId, action: 'EQUIPMENT_TYPE_DELETED', targetType: 'equipment_type', targetId: typeId },
      tx,
    );
  });
}

export async function createEquipmentItem(input: unknown): Promise<void> {
  const data = equipmentItemFormSchema.parse(input);
  const actor = await requireMaintainer();
  await prisma.$transaction(async (tx) => {
    const [type] = await tx.$queryRaw<Array<{ retired: boolean }>>`
      SELECT "retired" FROM "equipment_types" WHERE "id" = ${data.equipmentTypeId} FOR UPDATE
    `;
    if (!type || type.retired) throw new InvalidAssignmentError();
    const item = await tx.equipmentItem.create({
      data: { equipmentTypeId: data.equipmentTypeId, assetLabel: data.assetLabel },
      select: { id: true },
    });
    await recordAuditEvent(
      { actorId: actor.userId, action: 'EQUIPMENT_ITEM_CREATED', targetType: 'equipment_item', targetId: item.id },
      tx,
    );
  });
}

export async function assignEquipment(input: unknown): Promise<void> {
  const data = assignmentSchema.parse(input);
  const actor = await requireMaintainer();
  await prisma.$transaction(async (tx) => {
    const [helper] = await tx.$queryRaw<Array<{ id: string; active: boolean }>>`
      SELECT "id", "active" FROM "helpers" WHERE "id" = ${data.helperId} FOR UPDATE
    `;
    if (!helper || !helper.active) throw new InvalidAssignmentError();
    const item = await tx.equipmentItem.findUnique({
      where: { id: data.itemId },
      select: { id: true, status: true },
    });
    if (!item || item.status !== EquipmentStatus.AVAILABLE) throw new InvalidAssignmentError();
    const changed = await tx.equipmentItem.updateMany({
      where: { id: data.itemId, status: EquipmentStatus.AVAILABLE },
      data: { status: EquipmentStatus.ASSIGNED },
    });
    if (changed.count !== 1) throw new InvalidAssignmentError();
    const assignment = await tx.equipmentAssignment.create({
      data: { equipmentItemId: data.itemId, helperId: helper.id },
      select: { id: true },
    });
    await recordAuditEvents(
      [
        { actorId: actor.userId, action: 'EQUIPMENT_ASSIGNED', targetType: 'equipment_assignment', targetId: assignment.id },
        { actorId: actor.userId, action: 'EQUIPMENT_ITEM_STATUS_CHANGED', targetType: 'equipment_item', targetId: item.id },
        { actorId: actor.userId, action: 'HELPER_READ', targetType: 'helper', targetId: helper.id },
      ],
      tx,
    );
  });
}

export async function assignNewEquipmentToHelper(input: unknown): Promise<void> {
  const data = equipmentItemFormSchema.extend({ helperId: idSchema }).strict().parse(input);
  const actor = await requireMaintainer();
  await prisma.$transaction(async (tx) => {
    const [helper] = await tx.$queryRaw<Array<{ id: string; active: boolean }>>`
      SELECT "id", "active" FROM "helpers" WHERE "id" = ${data.helperId} FOR UPDATE
    `;
    if (!helper || !helper.active) throw new InvalidAssignmentError();
    const [type] = await tx.$queryRaw<Array<{ retired: boolean }>>`
      SELECT "retired" FROM "equipment_types" WHERE "id" = ${data.equipmentTypeId} FOR UPDATE
    `;
    if (!type || type.retired) throw new InvalidAssignmentError();
    const item = await tx.equipmentItem.create({
      data: { equipmentTypeId: data.equipmentTypeId, assetLabel: data.assetLabel, status: EquipmentStatus.ASSIGNED },
      select: { id: true },
    });
    const assignment = await tx.equipmentAssignment.create({
      data: { equipmentItemId: item.id, helperId: helper.id },
      select: { id: true },
    });
    await recordAuditEvents(
      [
        { actorId: actor.userId, action: 'EQUIPMENT_ITEM_CREATED', targetType: 'equipment_item', targetId: item.id },
        { actorId: actor.userId, action: 'EQUIPMENT_ASSIGNED', targetType: 'equipment_assignment', targetId: assignment.id },
        { actorId: actor.userId, action: 'HELPER_READ', targetType: 'helper', targetId: helper.id },
      ],
      tx,
    );
  });
}

export async function returnEquipment(input: unknown): Promise<void> {
  const { itemId } = itemIdSchema.parse(input);
  const actor = await requireMaintainer();
  await prisma.$transaction(async (tx) => {
    const [item] = await tx.$queryRaw<Array<{ status: EquipmentStatus }>>`
      SELECT "status" FROM "equipment_items" WHERE "id" = ${itemId} FOR UPDATE
    `;
    if (!item || item.status !== EquipmentStatus.ASSIGNED) throw new InvalidAssignmentError();
    const assignment = await tx.equipmentAssignment.findFirst({
      where: { equipmentItemId: itemId, returnedAt: null },
      select: { id: true, helperId: true },
    });
    if (!assignment) throw new InvalidAssignmentError();
    const returnedAt = new Date();
    const closed = await tx.equipmentAssignment.updateMany({
      where: { id: assignment.id, returnedAt: null },
      data: { returnedAt },
    });
    const changed = await tx.equipmentItem.updateMany({
      where: { id: itemId, status: EquipmentStatus.ASSIGNED },
      data: { status: EquipmentStatus.AVAILABLE },
    });
    if (closed.count !== 1 || changed.count !== 1) throw new InvalidAssignmentError();
    await recordAuditEvents(
      [
        { actorId: actor.userId, action: 'EQUIPMENT_RETURNED', targetType: 'equipment_assignment', targetId: assignment.id },
        { actorId: actor.userId, action: 'EQUIPMENT_ITEM_STATUS_CHANGED', targetType: 'equipment_item', targetId: itemId },
        { actorId: actor.userId, action: 'HELPER_READ', targetType: 'helper', targetId: assignment.helperId },
      ],
      tx,
    );
  });
}

export async function changeEquipmentStatus(input: unknown): Promise<void> {
  const { itemId, status } = z
    .object({ itemId: idSchema, status: equipmentStatusSchema })
    .strict()
    .parse(input);
  const actor = await requireMaintainer();
  await prisma.$transaction(async (tx) => {
    const item = await tx.equipmentItem.findUnique({
      where: { id: itemId },
      select: { status: true },
    });
    if (!item) throw new RecordNotFoundError();
    if (item.status === status) return;
    const allowed =
      (item.status === EquipmentStatus.AVAILABLE &&
        (status === EquipmentStatus.IN_REPAIR || status === EquipmentStatus.RETIRED)) ||
      (item.status === EquipmentStatus.IN_REPAIR &&
        (status === EquipmentStatus.AVAILABLE || status === EquipmentStatus.RETIRED));
    if (!allowed) throw new InvalidStatusTransitionError();
    const changed = await tx.equipmentItem.updateMany({
      where: { id: itemId, status: item.status },
      data: { status },
    });
    if (changed.count !== 1) throw new InvalidStatusTransitionError();
    await recordAuditEvent(
      { actorId: actor.userId, action: 'EQUIPMENT_ITEM_STATUS_CHANGED', targetType: 'equipment_item', targetId: itemId },
      tx,
    );
  });
}
