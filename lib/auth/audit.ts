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
  'ADMIN_RECOVERED',
  'HELPER_READ',
  'HELPER_CREATED',
  'HELPER_UPDATED',
  'QUALIFICATION_READ',
  'QUALIFICATION_CREATED',
  'QUALIFICATION_UPDATED',
  'QUALIFICATION_REMOVED',
  'QUALIFICATION_DEFINITION_READ',
  'QUALIFICATION_DEFINITION_CREATED',
  'QUALIFICATION_DEFINITION_UPDATED',
  'QUALIFICATION_DEFINITION_RETIRED',
  'EQUIPMENT_TYPE_READ',
  'EQUIPMENT_ITEM_READ',
  'EQUIPMENT_ASSIGNMENT_READ',
  'EQUIPMENT_TYPE_CREATED',
  'EQUIPMENT_TYPE_UPDATED',
  'EQUIPMENT_TYPE_RETIRED',
  'EQUIPMENT_TYPE_DELETED',
  'EQUIPMENT_ITEM_CREATED',
  'EQUIPMENT_ITEM_STATUS_CHANGED',
  'EQUIPMENT_ASSIGNED',
  'EQUIPMENT_RETURNED',
  'QUALIFICATION_EXPIRY_REPORT_ACCESSED',
  'QUALIFICATION_EXPIRY_REPORT_EXPORTED',
  'ORGANIZATION_CREATED',
  'ORGANIZATION_UPDATED',
  'RETENTION_POLICY_SET',
  'RETENTION_RUN',
  'HELPER_PURGED',
  'AUDIT_EVENTS_PURGED',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

type AuditTargetType =
  | 'account'
  | 'session'
  | 'helper'
  | 'qualification'
  | 'qualification_definition'
  | 'equipment_type'
  | 'equipment_item'
  | 'equipment_assignment'
  | 'organization'
  | 'report'
  | 'retention';

/** Only qualification validity changes may carry old/new values. */
export type AuditEventInput =
  | {
      actorId: string | null;
      action: 'QUALIFICATION_UPDATED' | 'QUALIFICATION_REMOVED';
      targetType: 'qualification';
      targetId: string | null;
      oldValue: string;
      newValue: string;
    }
  | {
      actorId: string | null;
      action: Exclude<AuditAction, 'QUALIFICATION_UPDATED' | 'QUALIFICATION_REMOVED'>;
      targetType: AuditTargetType;
      targetId: string | null;
    };

type AuditEventData = {
  actorId: string | null;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string | null;
  oldValue?: string;
  newValue?: string;
};

type AuditClient = PrismaClient | Prisma.TransactionClient;

function auditEventData(event: AuditEventInput): AuditEventData {
  return 'oldValue' in event
    ? {
        actorId: event.actorId,
        action: event.action,
        targetType: event.targetType,
        targetId: event.targetId,
        oldValue: event.oldValue,
        newValue: event.newValue,
      }
    : {
        actorId: event.actorId,
        action: event.action,
        targetType: event.targetType,
        targetId: event.targetId,
      };
}

export async function recordAuditEvent(event: AuditEventInput, client: AuditClient = prisma) {
  await client.auditEvent.create({
    data: auditEventData(event),
  });
}

export async function recordAuditEvents(events: AuditEventInput[], client: AuditClient = prisma) {
  if (events.length === 0) return;
  await client.auditEvent.createMany({
    data: events.map(auditEventData),
  });
}
