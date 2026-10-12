/**
 * Operator-run retention job (see README "Retention"). Uses the Administrator-approved
 * schedules; it is a dry run unless --confirm is given.
 *
 *   npm run retention:run -- --kind inactive-helper [--confirm]
 *   RETENTION_DATABASE_URL='<privileged role>' npm run retention:run -- --kind audit-log --confirm
 *
 * Audit-log deletion needs a role with DELETE on audit_events; the application role has none.
 */
import { PrismaClient } from '@prisma/client';
import prisma from '../lib/db';
import { RetentionPolicyMissingError, runRetention, type RetentionKind } from '../lib/retention';

const KINDS: Record<string, RetentionKind> = { 'inactive-helper': 'INACTIVE_HELPER', 'audit-log': 'AUDIT_LOG' };

async function main() {
  const index = process.argv.indexOf('--kind');
  const kind = index >= 0 ? KINDS[process.argv[index + 1] ?? ''] : undefined;
  if (!kind) throw new Error('Use --kind inactive-helper or --kind audit-log.');
  const url = process.env.RETENTION_DATABASE_URL;
  const client = url ? new PrismaClient({ datasourceUrl: url }) : undefined;
  try {
    const result = await runRetention(kind, { confirm: process.argv.includes('--confirm'), client });
    console.log(
      `${result.kind}: ${result.dryRun ? 'DRY RUN' : 'DELETED'} — period ${result.periodDays} days, cutoff ${result.cutoff.toISOString()}, ` +
        `eligible ${result.eligible}, deleted ${result.deleted}.`,
    );
    if (result.dryRun) console.log('Nothing was changed. Re-run with --confirm to delete.');
  } finally {
    await client?.$disconnect();
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof RetentionPolicyMissingError ? error.message : 'Retention run failed.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
