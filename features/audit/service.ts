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
    actorName: string | null;
    action: string;
    targetType: string;
    targetId: string | null;
    targetName: string | null;
    oldValue: string | null;
    newValue: string | null;
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
      oldValue: true,
      newValue: true,
      occurredAt: true,
    },
  });

  const hasMore = events.length > PAGE_SIZE;
  const items = events.slice(0, PAGE_SIZE);
  const [actorNames, targetNames] = await Promise.all([
    resolveActorNames(items),
    resolveTargetNames(items),
  ]);
  return {
    items: items.map((event) => ({
      ...event,
      actorName: event.actorId ? (actorNames.get(event.actorId) ?? null) : null,
      targetName: event.targetId ? (targetNames.get(`${event.targetType}:${event.targetId}`) ?? null) : null,
    })),
    nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
  };
}

type EventRef = { actorId: string | null; targetType: string; targetId: string | null };

function idsFor(items: EventRef[], ...types: string[]) {
  return [...new Set(items.filter((e) => e.targetId && types.includes(e.targetType)).map((e) => e.targetId as string))];
}

async function resolveActorNames(items: EventRef[]) {
  const ids = [...new Set(items.map((e) => e.actorId).filter((id): id is string => Boolean(id)))];
  const users = ids.length
    ? await prisma.authUser.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    : [];
  return new Map(users.map((u) => [u.id, u.name]));
}

// Names are shown only while the target still exists; otherwise the raw id stays visible.
async function resolveTargetNames(items: EventRef[]) {
  const names = new Map<string, string>();
  const accountIds = idsFor(items, 'account', 'USER');
  const helperIds = idsFor(items, 'helper');
  const qualificationIds = idsFor(items, 'qualification');
  const definitionIds = idsFor(items, 'qualification_definition');
  const organizationIds = idsFor(items, 'organization');
  const typeIds = idsFor(items, 'equipment_type');
  const itemIds = idsFor(items, 'equipment_item');
  const assignmentIds = idsFor(items, 'equipment_assignment');

  const [accounts, helpers, qualifications, definitions, organizations, types, equipmentItems, assignments] =
    await Promise.all([
      accountIds.length ? prisma.authUser.findMany({ where: { id: { in: accountIds } }, select: { id: true, name: true } }) : [],
      helperIds.length ? prisma.helper.findMany({ where: { id: { in: helperIds } }, select: { id: true, firstName: true, lastName: true } }) : [],
      qualificationIds.length
        ? prisma.helperQualification.findMany({
            where: { id: { in: qualificationIds } },
            select: { id: true, definition: { select: { name: true } }, helper: { select: { firstName: true, lastName: true } } },
          })
        : [],
      definitionIds.length ? prisma.qualificationDefinition.findMany({ where: { id: { in: definitionIds } }, select: { id: true, name: true } }) : [],
      organizationIds.length ? prisma.organization.findMany({ where: { id: { in: organizationIds } }, select: { id: true, name: true } }) : [],
      typeIds.length ? prisma.equipmentType.findMany({ where: { id: { in: typeIds } }, select: { id: true, name: true } }) : [],
      itemIds.length
        ? prisma.equipmentItem.findMany({
            where: { id: { in: itemIds } },
            select: { id: true, assetLabel: true, equipmentType: { select: { name: true } } },
          })
        : [],
      assignmentIds.length
        ? prisma.equipmentAssignment.findMany({
            where: { id: { in: assignmentIds } },
            select: {
              id: true,
              helper: { select: { firstName: true, lastName: true } },
              equipmentItem: { select: { assetLabel: true, equipmentType: { select: { name: true } } } },
            },
          })
        : [],
    ]);

  const itemLabel = (i: { assetLabel: string | null; equipmentType: { name: string } }) =>
    i.assetLabel ? `${i.equipmentType.name} ${i.assetLabel}` : i.equipmentType.name;
  const personName = (h: { firstName: string; lastName: string }) => `${h.firstName} ${h.lastName}`;

  for (const a of accounts) {
    names.set(`account:${a.id}`, a.name);
    names.set(`USER:${a.id}`, a.name);
  }
  for (const h of helpers) names.set(`helper:${h.id}`, personName(h));
  for (const q of qualifications) names.set(`qualification:${q.id}`, `${q.definition.name} (${personName(q.helper)})`);
  for (const d of definitions) names.set(`qualification_definition:${d.id}`, d.name);
  for (const o of organizations) names.set(`organization:${o.id}`, o.name);
  for (const t of types) names.set(`equipment_type:${t.id}`, t.name);
  for (const i of equipmentItems) names.set(`equipment_item:${i.id}`, itemLabel(i));
  for (const a of assignments) names.set(`equipment_assignment:${a.id}`, `${itemLabel(a.equipmentItem)} → ${personName(a.helper)}`);
  return names;
}
