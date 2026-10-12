import prisma from '@/lib/db';

/** Audit events are append-only at the DB level; tests reset them with TRUNCATE. */
export async function clearAudit() {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "audit_events"');
}
