import 'server-only';
import { z } from 'zod';
import prisma from '@/lib/db';
import { requireMaintainer } from '@/lib/auth/guards';
import { recordAuditEvent, recordAuditEvents } from '@/lib/auth/audit';
import {
  createHelperSchema,
  directorySearchSchema,
  updateHelperSchema,
} from './schemas';
import { InvalidCursorError, InvalidOrganizationError, RecordNotFoundError } from './errors';

const DIRECTORY_PAGE_SIZE = 25;
const zHelperId = z.string().trim().min(1).max(64);

export type HelperDirectoryPage = {
  items: Array<{
    id: string;
    firstName: string;
    lastName: string;
    active: boolean;
  }>;
  nextCursor: string | null;
};

export type HelperProfile = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  active: boolean;
  organization: { id: string; name: string } | null;
  qualifications: Array<{
    id: string;
    definitionId: string;
    title: string;
    definitionRetired: boolean;
    validThrough: string | null;
  }>;
  equipment: Array<{
    assignmentId: string;
    itemId: string;
    assetLabel: string | null;
    status: string;
    equipmentTypeId: string;
    equipmentTypeName: string;
  }>;
};

export type HelperFormData = Pick<
  HelperProfile,
  'id' | 'firstName' | 'lastName' | 'email' | 'phone' | 'address' | 'active'
> & { organizationId: string | null };

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// Retired organizations may stay on existing helpers but cannot be newly chosen.
async function assertAssignableOrganization(tx: Tx, organizationId: string, currentId: string | null) {
  const organization = await tx.organization.findUnique({
    where: { id: organizationId },
    select: { active: true },
  });
  if (!organization || (!organization.active && organizationId !== currentId)) {
    throw new InvalidOrganizationError();
  }
}

export async function listHelpers(input: unknown): Promise<HelperDirectoryPage> {
  const data = directorySearchSchema.parse(input);
  const actor = await requireMaintainer();
  return prisma.$transaction(async (tx) => {
    if (data.cursorId) {
      const cursor = await tx.helper.findUnique({ where: { id: data.cursorId }, select: { id: true } });
      if (!cursor) throw new InvalidCursorError();
    }

    const records = await tx.helper.findMany({
      where: data.search
        ? {
            OR: [
              { firstName: { contains: data.search, mode: 'insensitive' } },
              { lastName: { contains: data.search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
      take: DIRECTORY_PAGE_SIZE + 1,
      ...(data.cursorId ? { cursor: { id: data.cursorId }, skip: 1 } : {}),
      select: { id: true, firstName: true, lastName: true, active: true },
    });
    const hasMore = records.length > DIRECTORY_PAGE_SIZE;
    const items = records.slice(0, DIRECTORY_PAGE_SIZE);
    await recordAuditEvents(
      items.map(({ id }) => ({
        actorId: actor.userId,
        action: 'HELPER_READ',
        targetType: 'helper',
        targetId: id,
      })),
      tx,
    );
    return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
  });
}

export async function getHelperProfile(input: unknown): Promise<HelperProfile | null> {
  const helperId = zHelperId.parse(input);
  const actor = await requireMaintainer();
  return prisma.$transaction(async (tx) => {
    const helper = await tx.helper.findUnique({
      where: { id: helperId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        active: true,
        organization: { select: { id: true, name: true } },
        qualifications: {
          orderBy: [{ definition: { name: 'asc' } }, { id: 'asc' }],
          select: { id: true, validThrough: true, definition: { select: { id: true, name: true, retired: true } } },
        },
        equipmentAssignments: {
          where: { returnedAt: null },
          orderBy: [{ assignedAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            equipmentItem: {
              select: {
                id: true,
                assetLabel: true,
                status: true,
                equipmentTypeId: true,
                equipmentType: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    if (!helper) return null;

    await recordAuditEvents(
      [
        { actorId: actor.userId, action: 'HELPER_READ', targetType: 'helper', targetId: helper.id },
        ...helper.qualifications.map(({ id }) => ({
          actorId: actor.userId,
          action: 'QUALIFICATION_READ' as const,
          targetType: 'qualification' as const,
          targetId: id,
        })),
        ...[...new Set(helper.qualifications.map(({ definition }) => definition.id))].map((targetId) => ({
          actorId: actor.userId,
          action: 'QUALIFICATION_DEFINITION_READ' as const,
          targetType: 'qualification_definition' as const,
          targetId,
        })),
        ...helper.equipmentAssignments.flatMap(({ id, equipmentItem }) => [
          {
            actorId: actor.userId,
            action: 'EQUIPMENT_ASSIGNMENT_READ' as const,
            targetType: 'equipment_assignment' as const,
            targetId: id,
          },
          {
            actorId: actor.userId,
            action: 'EQUIPMENT_ITEM_READ' as const,
            targetType: 'equipment_item' as const,
            targetId: equipmentItem.id,
          },
          {
            actorId: actor.userId,
            action: 'EQUIPMENT_TYPE_READ' as const,
            targetType: 'equipment_type' as const,
            targetId: equipmentItem.equipmentTypeId,
          },
        ]),
      ],
      tx,
    );
    return {
      ...helper,
      qualifications: helper.qualifications.map(({ definition, ...qualification }) => ({
        ...qualification,
        definitionId: definition.id,
        title: definition.name,
        definitionRetired: definition.retired,
        validThrough: qualification.validThrough?.toISOString().slice(0, 10) ?? null,
      })),
      equipment: helper.equipmentAssignments.map(({ id, equipmentItem }) => ({
        assignmentId: id,
        itemId: equipmentItem.id,
        assetLabel: equipmentItem.assetLabel,
        status: equipmentItem.status,
        equipmentTypeId: equipmentItem.equipmentTypeId,
        equipmentTypeName: equipmentItem.equipmentType.name,
      })),
    };
  });
}

export async function getHelperFormData(input: unknown): Promise<HelperFormData | null> {
  const helperId = zHelperId.parse(input);
  const actor = await requireMaintainer();
  return prisma.$transaction(async (tx) => {
    const helper = await tx.helper.findUnique({
      where: { id: helperId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        active: true,
        organizationId: true,
      },
    });
    if (!helper) return null;
    await recordAuditEvent(
      { actorId: actor.userId, action: 'HELPER_READ', targetType: 'helper', targetId: helper.id },
      tx,
    );
    return helper;
  });
}

export async function createHelper(input: unknown): Promise<{ helperId: string }> {
  const data = createHelperSchema.parse(input);
  const actor = await requireMaintainer();
  return prisma.$transaction(async (tx) => {
    if (data.organizationId) await assertAssignableOrganization(tx, data.organizationId, null);
    const helper = await tx.helper.create({ data });
    await recordAuditEvent(
      { actorId: actor.userId, action: 'HELPER_CREATED', targetType: 'helper', targetId: helper.id },
      tx,
    );
    return { helperId: helper.id };
  });
}

export async function updateHelper(input: unknown): Promise<void> {
  const data = updateHelperSchema.parse(input);
  const actor = await requireMaintainer();
  const { helperId, ...changes } = data;
  await prisma.$transaction(async (tx) => {
    const current = await tx.helper.findUnique({
      where: { id: helperId },
      select: { active: true, organizationId: true },
    });
    if (!current) throw new RecordNotFoundError();
    if (changes.organizationId) {
      await assertAssignableOrganization(tx, changes.organizationId, current.organizationId);
    }
    // The retention clock starts when a helper becomes inactive and resets on reactivation.
    const deactivatedAt =
      changes.active === undefined || changes.active === current.active
        ? undefined
        : changes.active
          ? null
          : new Date();
    const result = await tx.helper.updateMany({ where: { id: helperId }, data: { ...changes, deactivatedAt } });
    if (result.count !== 1) throw new RecordNotFoundError();
    await recordAuditEvent(
      { actorId: actor.userId, action: 'HELPER_UPDATED', targetType: 'helper', targetId: helperId },
      tx,
    );
  });
}
