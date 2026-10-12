import 'server-only';
import { z } from 'zod';
import prisma from '@/lib/db';
import { requireMaintainer } from '@/lib/auth/guards';

const PAGE_SIZE = 50;

const auditPageInputSchema = z
  .object({
    afterId: z.preprocess(
      (value: unknown) => (value === '' || value === undefined ? null : value),
      z.string().trim().min(1).max(64).nullable(),
    ),
  })
  .strict();

export type AuditEventPage = {
  items: Array<{
    id: string;
    actorId: string | null;
    action: string;
    targetType: string;
    targetId: string | null;
    occurredAt: Date;
  }>;
  nextCursor: string | null;
};

export async function listAuditEvents(input: unknown): Promise<AuditEventPage> {
  const { afterId } = auditPageInputSchema.parse(input);
  await requireMaintainer();

  const events = await prisma.auditEvent.findMany({
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    take: PAGE_SIZE + 1,
    ...(afterId ? { cursor: { id: afterId }, skip: 1 } : {}),
    select: {
      id: true,
      actorId: true,
      action: true,
      targetType: true,
      targetId: true,
      occurredAt: true,
    },
  });

  const hasMore = events.length > PAGE_SIZE;
  const items = events.slice(0, PAGE_SIZE);
  return {
    items,
    nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
  };
}
