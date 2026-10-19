import { z } from 'zod';
import { EquipmentStatus, Prisma, type PrismaClient } from '@prisma/client';
import prisma from '@/lib/db';
import { recordAuditEvent, recordAuditEvents } from '@/lib/auth/audit';

export const RETENTION_KINDS = ['INACTIVE_HELPER', 'AUDIT_LOG'] as const;
export type RetentionKind = (typeof RETENTION_KINDS)[number];

export const retentionPolicySchema = z
  .object({
    kind: z.enum(RETENTION_KINDS),
    periodDays: z.coerce.number().int().min(1).max(36500),
    decisionReference: z.string().trim().min(1).max(200),
    confirmApproved: z.literal('on'),
  })
  .strict();

const DAY_MS = 86_400_000;

export class RetentionPolicyMissingError extends Error {
  constructor(kind: RetentionKind) {
    super(`No approved retention schedule is configured for ${kind}.`);
  }
}

export type RetentionResult = {
  kind: RetentionKind;
  dryRun: boolean;
  periodDays: number;
  cutoff: Date;
  eligible: number;
  deleted: number;
};

type Options = { confirm?: boolean; now?: Date; client?: PrismaClient };

/**
 * Operator-run retention. Dry run unless `confirm` is true. Uses the approved schedule only;
 * there is no default period. Reports counts, never personal values.
 */
export async function runRetention(kind: RetentionKind, options: Options = {}): Promise<RetentionResult> {
  const client = options.client ?? prisma;
  const dryRun = options.confirm !== true;
  const now = options.now ?? new Date();
  const policy = await client.retentionPolicy.findUnique({ where: { kind } });
  if (!policy) throw new RetentionPolicyMissingError(kind);
  const cutoff = new Date(now.getTime() - policy.periodDays * DAY_MS);
  const base = { kind, dryRun, periodDays: policy.periodDays, cutoff };

  if (kind === 'INACTIVE_HELPER') {
    const where = { active: false, deactivatedAt: { lt: cutoff } };
    if (dryRun) return { ...base, eligible: await client.helper.count({ where }), deleted: 0 };
    return client.$transaction(async (tx) => {
      const eligible = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "helpers"
        WHERE "active" = false AND "deactivatedAt" < ${cutoff}
        FOR UPDATE
      `;
      const ids = eligible.map((helper) => helper.id);
      const assignedItems = ids.length
        ? await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
            SELECT "id" FROM "equipment_items"
            WHERE "status" = 'ASSIGNED'
              AND "id" IN (
                SELECT "equipmentItemId" FROM "equipment_assignments"
                WHERE "helperId" IN (${Prisma.join(ids)}) AND "returnedAt" IS NULL
              )
            FOR UPDATE
          `)
        : [];
      if (assignedItems.length) {
        await tx.equipmentItem.updateMany({
          where: {
            id: { in: assignedItems.map(({ id }) => id) },
            status: EquipmentStatus.ASSIGNED,
          },
          data: { status: EquipmentStatus.AVAILABLE },
        });
      }
      // Qualifications and helper-linked assignment history cascade with the helper.
      const { count } = await tx.helper.deleteMany({ where: { id: { in: ids }, ...where } });
      await recordAuditEvents(
        [
          ...ids.map((id) => ({
            actorId: null,
            action: 'HELPER_PURGED' as const,
            targetType: 'helper' as const,
            targetId: id,
          })),
          ...assignedItems.map(({ id }) => ({
            actorId: null,
            action: 'EQUIPMENT_ITEM_STATUS_CHANGED' as const,
            targetType: 'equipment_item' as const,
            targetId: id,
          })),
        ],
        tx,
      );
      await recordAuditEvent({ actorId: null, action: 'RETENTION_RUN', targetType: 'retention', targetId: kind }, tx);
      return { ...base, eligible: ids.length, deleted: count };
    });
  }

  const where = { occurredAt: { lt: cutoff } };
  if (dryRun) return { ...base, eligible: await client.auditEvent.count({ where }), deleted: 0 };
  return client.$transaction(async (tx: Prisma.TransactionClient) => {
    // Transaction-local opt-in required by the append-only trigger; needs a privileged DB role.
    await tx.$executeRaw`SELECT set_config('app.audit_retention', 'on', true)`;
    const { count } = await tx.auditEvent.deleteMany({ where });
    await recordAuditEvent({ actorId: null, action: 'AUDIT_EVENTS_PURGED', targetType: 'retention', targetId: kind }, tx);
    await recordAuditEvent({ actorId: null, action: 'RETENTION_RUN', targetType: 'retention', targetId: kind }, tx);
    return { ...base, eligible: count, deleted: count };
  });
}
