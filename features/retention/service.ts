import 'server-only';
import prisma from '@/lib/db';
import { recordAuditEvent } from '@/lib/auth/audit';
import { requireAdministrator } from '@/lib/auth/guards';
import { retentionPolicySchema } from '@/lib/retention';

export async function listRetentionPolicies() {
  await requireAdministrator();
  return prisma.retentionPolicy.findMany({ orderBy: { kind: 'asc' } });
}

/** Records the organization's approved schedule. The approver is always the signed-in Administrator. */
export async function setRetentionPolicy(input: unknown) {
  const actor = await requireAdministrator();
  const data = retentionPolicySchema.parse(input);
  await prisma.$transaction(async (tx) => {
    await tx.retentionPolicy.upsert({
      where: { kind: data.kind },
      create: {
        kind: data.kind,
        periodDays: data.periodDays,
        decisionReference: data.decisionReference,
        approvedById: actor.userId,
      },
      update: {
        periodDays: data.periodDays,
        decisionReference: data.decisionReference,
        approvedById: actor.userId,
        approvedAt: new Date(),
      },
    });
    await recordAuditEvent(
      { actorId: actor.userId, action: 'RETENTION_POLICY_SET', targetType: 'retention', targetId: data.kind },
      tx,
    );
  });
}


