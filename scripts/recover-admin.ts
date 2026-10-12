/**
 * Operator break-glass recovery when no other verified Administrator is available.
 * Run on the server by an authorised operator (see README "Administrator recovery").
 *
 *   RECOVER_ADMIN_PASSWORD='<new temporary password>' npm run auth:recover-admin -- \
 *     --email admin@example.org --confirm
 *
 * Removes the TOTP factor, revokes all sessions, re-enables the account and sets
 * the temporary password. The Administrator must re-enrol TOTP before any access.
 */
import { z } from 'zod';
import prisma from '../lib/db';
import { RecoveryError, recoverAdministrator } from '../lib/auth/recovery';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  if (!process.argv.includes('--confirm')) throw new Error('Refusing to run without --confirm.');
  const { userId } = await recoverAdministrator({ email: arg('email'), newPassword: process.env.RECOVER_ADMIN_PASSWORD });
  console.log(`Administrator recovered (${userId}). They must sign in and re-enrol TOTP. Share the temporary password out of band.`);
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof z.ZodError
        ? 'Invalid or missing input (email, RECOVER_ADMIN_PASSWORD).'
        : error instanceof RecoveryError
          ? error.message
          : 'Recovery failed.',
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
