import 'server-only';
import prisma from '@/lib/db';
import { requireMaintainer } from '@/lib/auth/guards';
import { recordAuditEvent, recordAuditEvents } from '@/lib/auth/audit';
import { dateOnlyToUtcDate, getQualificationExpiryStatus, getQualificationExpiryWindow } from '@/features/reports/qualification-expiry';
import {
  createQualificationSchema,
  updateQualificationSchema,
} from '@/features/helpers/schemas';
import { InvalidCursorError, RecordNotFoundError } from '@/features/helpers/errors';
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
    const qualification = await tx.helperQualification.create({
      data: {
        helperId: data.helperId,
        title: data.title,
        validThrough: data.validThrough ? dateOnlyToUtcDate(data.validThrough) : null,
      },
      select: { id: true },
    });
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
    const result = await tx.helperQualification.updateMany({
      where: { id: data.qualificationId, helperId: data.helperId },
      data: {
        title: data.title,
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
        title: true,
        validThrough: true,
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
              qualificationTitle: record.title,
              validThrough,
              status,
            }]
          : [];
      }),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  });
}
