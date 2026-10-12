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
import { InvalidCursorError, RecordNotFoundError } from './errors';

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
  qualifications: Array<{
    id: string;
    title: string;
    validThrough: string | null;
  }>;
};

export type HelperFormData = Pick<
  HelperProfile,
  'id' | 'firstName' | 'lastName' | 'email' | 'phone' | 'address' | 'active'
>;

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
        qualifications: {
          orderBy: [{ title: 'asc' }, { id: 'asc' }],
          select: { id: true, title: true, validThrough: true },
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
      ],
      tx,
    );
    return {
      ...helper,
      qualifications: helper.qualifications.map((qualification) => ({
        ...qualification,
        validThrough: qualification.validThrough?.toISOString().slice(0, 10) ?? null,
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
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, address: true, active: true },
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
    const result = await tx.helper.updateMany({ where: { id: helperId }, data: changes });
    if (result.count !== 1) throw new RecordNotFoundError();
    await recordAuditEvent(
      { actorId: actor.userId, action: 'HELPER_UPDATED', targetType: 'helper', targetId: helperId },
      tx,
    );
  });
}
