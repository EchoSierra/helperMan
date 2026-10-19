import 'server-only';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/db';
import { requireMaintainer } from '@/lib/auth/guards';
import { recordAuditEvent, recordAuditEvents } from '@/lib/auth/audit';
import { DuplicateMasterDataError, RecordNotFoundError } from '@/features/helpers/errors';
import { qualificationDefinitionSchema } from '@/features/helpers/schemas';

const idSchema = z.string().trim().min(1).max(64);

export type QualificationDefinitionItem = {
  id: string;
  name: string;
  category: string | null;
  retired: boolean;
};

async function assertNameAvailable(tx: Prisma.TransactionClient, name: string, exceptId?: string) {
  const existing = await tx.qualificationDefinition.findFirst({
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

export async function listQualificationDefinitions(): Promise<QualificationDefinitionItem[]> {
  const actor = await requireMaintainer();
  return prisma.$transaction(async (tx) => {
    const rows = await tx.qualificationDefinition.findMany({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, category: true, retired: true },
    });
    await recordAuditEvents(
      rows.map(({ id }) => ({
        actorId: actor.userId,
        action: 'QUALIFICATION_DEFINITION_READ',
        targetType: 'qualification_definition',
        targetId: id,
      })),
      tx,
    );
    return rows;
  });
}

export async function listQualificationOptions(currentDefinitionIds: string[]): Promise<QualificationDefinitionItem[]> {
  const ids = z.array(idSchema).max(500).parse(currentDefinitionIds);
  const actor = await requireMaintainer();
  return prisma.$transaction(async (tx) => {
    const rows = await tx.qualificationDefinition.findMany({
      where: { OR: [{ retired: false }, ...(ids.length ? [{ id: { in: ids } }] : [])] },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, category: true, retired: true },
    });
    await recordAuditEvents(
      rows.map(({ id }) => ({
        actorId: actor.userId,
        action: 'QUALIFICATION_DEFINITION_READ',
        targetType: 'qualification_definition',
        targetId: id,
      })),
      tx,
    );
    return rows;
  });
}

export async function createQualificationDefinition(input: unknown): Promise<void> {
  const data = qualificationDefinitionSchema.parse(input);
  const actor = await requireMaintainer();
  try {
    await prisma.$transaction(async (tx) => {
      await assertNameAvailable(tx, data.name);
      const row = await tx.qualificationDefinition.create({
        data,
        select: { id: true },
      });
      await recordAuditEvent(
        {
          actorId: actor.userId,
          action: 'QUALIFICATION_DEFINITION_CREATED',
          targetType: 'qualification_definition',
          targetId: row.id,
        },
        tx,
      );
    });
  } catch (error) {
    mapUniqueError(error);
  }
}

export async function updateQualificationDefinition(input: unknown): Promise<void> {
  const data = qualificationDefinitionSchema
    .extend({ definitionId: idSchema, retired: z.boolean() })
    .strict()
    .parse(input);
  const actor = await requireMaintainer();
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.qualificationDefinition.findUnique({
        where: { id: data.definitionId },
        select: { retired: true },
      });
      if (!existing) throw new RecordNotFoundError();
      await assertNameAvailable(tx, data.name, data.definitionId);
      const result = await tx.qualificationDefinition.updateMany({
        where: { id: data.definitionId },
        data: { name: data.name, category: data.category, retired: data.retired },
      });
      if (result.count !== 1) throw new RecordNotFoundError();
      await recordAuditEvent(
        {
          actorId: actor.userId,
          action: !existing.retired && data.retired
            ? 'QUALIFICATION_DEFINITION_RETIRED'
            : 'QUALIFICATION_DEFINITION_UPDATED',
          targetType: 'qualification_definition',
          targetId: data.definitionId,
        },
        tx,
      );
    });
  } catch (error) {
    mapUniqueError(error);
  }
}
