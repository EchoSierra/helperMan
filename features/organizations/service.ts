import 'server-only';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/db';
import { requireMaintainer } from '@/lib/auth/guards';
import { recordAuditEvent } from '@/lib/auth/audit';
import { DuplicateOrganizationError, RecordNotFoundError } from '@/features/helpers/errors';
import { organizationNameSchema } from '@/features/helpers/schemas';

const zId = z.string().trim().min(1).max(64);

export type OrganizationItem = { id: string; name: string; active: boolean };

export async function listOrganizations(): Promise<OrganizationItem[]> {
  await requireMaintainer();
  return prisma.organization.findMany({
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true, active: true },
  });
}

/** Active organizations plus the helper's current one, so a retired value still displays. */
export async function listOrganizationOptions(currentId: string | null): Promise<OrganizationItem[]> {
  await requireMaintainer();
  return prisma.organization.findMany({
    where: { OR: [{ active: true }, ...(currentId ? [{ id: currentId }] : [])] },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true, active: true },
  });
}

async function assertNameFree(tx: Prisma.TransactionClient, name: string, exceptId?: string) {
  const clash = await tx.organization.findFirst({
    where: { name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (clash) throw new DuplicateOrganizationError();
}

function mapUnique(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new DuplicateOrganizationError();
  }
  throw error;
}

export async function createOrganization(input: unknown): Promise<{ organizationId: string }> {
  const data = organizationNameSchema.parse(input);
  const actor = await requireMaintainer();
  try {
    return await prisma.$transaction(async (tx) => {
      await assertNameFree(tx, data.name);
      const organization = await tx.organization.create({ data: { name: data.name } });
      await recordAuditEvent(
        { actorId: actor.userId, action: 'ORGANIZATION_CREATED', targetType: 'organization', targetId: organization.id },
        tx,
      );
      return { organizationId: organization.id };
    });
  } catch (error) {
    return mapUnique(error);
  }
}

export async function updateOrganization(input: unknown): Promise<void> {
  const data = organizationNameSchema
    .extend({ organizationId: zId, active: z.boolean() })
    .strict()
    .parse(input);
  const actor = await requireMaintainer();
  try {
    await prisma.$transaction(async (tx) => {
      await assertNameFree(tx, data.name, data.organizationId);
      const result = await tx.organization.updateMany({
        where: { id: data.organizationId },
        data: { name: data.name, active: data.active },
      });
      if (result.count !== 1) throw new RecordNotFoundError();
      await recordAuditEvent(
        { actorId: actor.userId, action: 'ORGANIZATION_UPDATED', targetType: 'organization', targetId: data.organizationId },
        tx,
      );
    });
  } catch (error) {
    mapUnique(error);
  }
}
