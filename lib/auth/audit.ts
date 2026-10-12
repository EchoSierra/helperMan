import type { Prisma, PrismaClient } from '@prisma/client';
import prisma from '@/lib/db';

export const AUDIT_ACTIONS = [
  'SIGN_IN_FAILED',
  'SIGN_IN_PASSWORD_ACCEPTED',
  'SIGN_IN_BLOCKED',
  'SESSION_STARTED',
  'SIGN_OUT',
  'TOTP_ENROLLMENT_STARTED',
  'TOTP_VERIFIED',
  'TOTP_VERIFICATION_FAILED',
  'ACCOUNT_CREATED',
  'ACCOUNT_DELETED',
  'ACCOUNT_DISABLED',
  'ACCOUNT_ENABLED',
  'SESSIONS_REVOKED',
  'ROLE_GRANTED',
  'ROLE_REVOKED',
  'ADMIN_ROLE_GRANTED',
  'ADMIN_ROLE_REVOKED',
  'PASSWORD_RESET',
  'PASSWORD_CHANGED',
  'PASSWORD_CHANGE_FAILED',
  'TOTP_RESET',
  'ADMIN_BOOTSTRAPPED',
  'HELPER_READ',
  'HELPER_CREATED',
  'HELPER_UPDATED',
  'QUALIFICATION_READ',
  'QUALIFICATION_CREATED',
  'QUALIFICATION_UPDATED',
  'QUALIFICATION_EXPIRY_REPORT_ACCESSED',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** The complete, deliberately minimal event shape. Time is set by the database. */
export type AuditEventInput = {
  actorId: string | null;
  action: AuditAction;
  targetType: 'account' | 'session' | 'helper' | 'qualification' | 'report';
  targetId: string | null;
};

type AuditClient = PrismaClient | Prisma.TransactionClient;

export async function recordAuditEvent(event: AuditEventInput, client: AuditClient = prisma) {
  await client.auditEvent.create({
    data: {
      actorId: event.actorId,
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId,
    },
  });
}

export async function recordAuditEvents(events: AuditEventInput[], client: AuditClient = prisma) {
  if (events.length === 0) return;
  await client.auditEvent.createMany({
    data: events.map(({ actorId, action, targetType, targetId }) => ({
      actorId,
      action,
      targetType,
      targetId,
    })),
  });
}
