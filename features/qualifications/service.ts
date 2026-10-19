import 'server-only';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { requireMaintainer } from '@/lib/auth/guards';
import { recordAuditEvent, recordAuditEvents } from '@/lib/auth/audit';
import { dateOnlyToUtcDate, getQualificationExpiryStatus, getQualificationExpiryWindow } from '@/features/reports/qualification-expiry';
import {
  createQualificationSchema,
  updateQualificationSchema,
} from '@/features/helpers/schemas';
import {
  DuplicateQualificationAssignmentError,
  InvalidAssignmentError,
  InvalidCursorError,
  RecordNotFoundError,
} from '@/features/helpers/errors';
import { z } from 'zod';

const qualificationId = z.string().trim().min(1).max(64);
const expiryCursorSchema = z
  .object({ afterId: qualificationId.nullable(), reportDate: z.iso.date().optional() })
  .strict();
const REPORT_PAGE_SIZE = 50;

export type QualificationExpiryPage = {
  today: string;
  through: string;
  items: Array<{
    helperId: string;
    helperName: string;
    helperActive: boolean;
    qualificationTitle: string;
    validThrough: string;
    status: 'Expired' | 'Expiring';
  }>;
  nextCursor: string | null;
};

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export async function createQualification(input: unknown): Promise<{ qualificationId: string }> {
  const data = createQualificationSchema.parse(input);
  const actor = await requireMaintainer();
  return prisma.$transaction(async (tx) => {
    const helper = await tx.helper.findUnique({ where: { id: data.helperId }, select: { id: true } });
    if (!helper) throw new RecordNotFoundError();
    const [definition] = await tx.$queryRaw<Array<{ id: string; retired: boolean }>>`
      SELECT "id", "retired" FROM "qualification_definitions" WHERE "id" = ${data.definitionId} FOR UPDATE
    `;
    if (!definition || definition.retired) throw new InvalidAssignmentError();
    let qualification;
    try {
      qualification = await tx.helperQualification.create({
        data: {
          helperId: data.helperId,
          definitionId: data.definitionId,
          validThrough: data.validThrough ? dateOnlyToUtcDate(data.validThrough) : null,
        },
        select: { id: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DuplicateQualificationAssignmentError();
      }
      throw error;
    }
    await recordAuditEvent(
      {
        actorId: actor.userId,
        action: 'QUALIFICATION_CREATED',
        targetType: 'qualification',
        targetId: qualification.id,
      },
      tx,
    );
    return { qualificationId: qualification.id };
  });
}

export async function updateQualification(input: unknown): Promise<void> {
  const data = updateQualificationSchema.parse(input);
  const actor = await requireMaintainer();
  await prisma.$transaction(async (tx) => {
    const [existing] = await tx.$queryRaw<Array<{ id: string; validThrough: Date | null }>>`
      SELECT "id", "validThrough" FROM "helper_qualifications"
      WHERE "id" = ${data.qualificationId} AND "helperId" = ${data.helperId}
      FOR UPDATE
    `;
    if (!existing) throw new RecordNotFoundError();
    const oldValue = existing.validThrough ? dateOnly(existing.validThrough) : 'Not set';
    const newValue = data.validThrough ?? 'Not set';
    if (oldValue === newValue) return;
    const result = await tx.helperQualification.updateMany({
      where: { id: data.qualificationId, helperId: data.helperId },
      data: {
        validThrough: data.validThrough ? dateOnlyToUtcDate(data.validThrough) : null,
      },
    });
    if (result.count !== 1) throw new RecordNotFoundError();
    await recordAuditEvent(
      {
        actorId: actor.userId,
        action: 'QUALIFICATION_UPDATED',
        targetType: 'qualification',
        targetId: data.qualificationId,
        oldValue,
        newValue,
      },
      tx,
    );
  });
}

export async function removeQualification(input: unknown): Promise<void> {
  const data = z
    .object({ helperId: qualificationId, qualificationId })
    .strict()
    .parse(input);
  const actor = await requireMaintainer();
  await prisma.$transaction(async (tx) => {
    const [existing] = await tx.$queryRaw<Array<{ validThrough: Date | null }>>`
      SELECT "validThrough" FROM "helper_qualifications"
      WHERE "id" = ${data.qualificationId} AND "helperId" = ${data.helperId}
      FOR UPDATE
    `;
    if (!existing) throw new RecordNotFoundError();
    const result = await tx.helperQualification.deleteMany({
      where: { id: data.qualificationId, helperId: data.helperId },
    });
    if (result.count !== 1) throw new RecordNotFoundError();
    await recordAuditEvent(
      {
        actorId: actor.userId,
        action: 'QUALIFICATION_REMOVED',
        targetType: 'qualification',
        targetId: data.qualificationId,
        oldValue: existing.validThrough ? dateOnly(existing.validThrough) : 'Not set',
        newValue: 'Removed',
      },
      tx,
    );
  });
}

export async function listQualificationExpiries(input: unknown): Promise<QualificationExpiryPage> {
  const { afterId, reportDate } = expiryCursorSchema.parse(input);
  const actor = await requireMaintainer();
  const { today, through } = getQualificationExpiryWindow();
  if (reportDate && reportDate !== today) throw new InvalidCursorError();
  return prisma.$transaction(async (tx) => {
    if (afterId) {
      const cursor = await tx.helperQualification.findUnique({ where: { id: afterId }, select: { id: true } });
      if (!cursor) throw new InvalidCursorError();
    }

    const records = await tx.helperQualification.findMany({
      where: { validThrough: { not: null, lte: dateOnlyToUtcDate(through) } },
      orderBy: [{ validThrough: 'asc' }, { id: 'asc' }],
      take: REPORT_PAGE_SIZE + 1,
      ...(afterId ? { cursor: { id: afterId }, skip: 1 } : {}),
      select: {
        id: true,
        validThrough: true,
        definition: { select: { id: true, name: true } },
        helper: { select: { id: true, firstName: true, lastName: true, active: true } },
      },
    });
    const hasMore = records.length > REPORT_PAGE_SIZE;
    const page = records.slice(0, REPORT_PAGE_SIZE);
    const helperIds = [...new Set(page.map(({ helper }) => helper.id))];
    await recordAuditEvents(
      [
        ...helperIds.map((targetId) => ({
          actorId: actor.userId,
          action: 'HELPER_READ' as const,
          targetType: 'helper' as const,
          targetId,
        })),
        ...page.map(({ id }) => ({
          actorId: actor.userId,
          action: 'QUALIFICATION_READ' as const,
          targetType: 'qualification' as const,
          targetId: id,
        })),
        ...[...new Set(page.map(({ definition }) => definition.id))].map((targetId) => ({
          actorId: actor.userId,
          action: 'QUALIFICATION_DEFINITION_READ' as const,
          targetType: 'qualification_definition' as const,
          targetId,
        })),
        {
          actorId: actor.userId,
          action: 'QUALIFICATION_EXPIRY_REPORT_ACCESSED',
          targetType: 'report',
          targetId: 'qualification-expiry',
        },
      ],
      tx,
    );
    return {
      today,
      through,
      items: page.flatMap((record) => {
        if (!record.validThrough) return [];
        const validThrough = dateOnly(record.validThrough);
        const status = getQualificationExpiryStatus(validThrough, today, through);
        return status
          ? [{
              helperId: record.helper.id,
              helperName: `${record.helper.firstName} ${record.helper.lastName}`,
              helperActive: record.helper.active,
              qualificationTitle: record.definition.name,
              validThrough,
              status,
            }]
          : [];
      }),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  });
}

export async function exportQualificationExpiries(): Promise<QualificationExpiryPage['items']> {
  const items: QualificationExpiryPage['items'] = [];
  let afterId: string | null = null;
  let reportDate: string | undefined;

  do {
    const page = await listQualificationExpiries({ afterId, ...(reportDate ? { reportDate } : {}) });
    items.push(...page.items);
    afterId = page.nextCursor;
    reportDate = page.today;
  } while (afterId);

  const actor = await requireMaintainer();
  await recordAuditEvent({
    actorId: actor.userId,
    action: 'QUALIFICATION_EXPIRY_REPORT_EXPORTED',
    targetType: 'report',
    targetId: 'qualification-expiry',
  });
  return items;
}
