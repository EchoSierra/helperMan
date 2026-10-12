/**
 * Controlled first-Administrator bootstrap. Not a public endpoint.
 *
 *   BOOTSTRAP_ADMIN_PASSWORD='...' DATABASE_URL=... npm run auth:bootstrap-admin -- \
 *     --email admin@example.org --name "Admin Name" --confirm
 *
 * The password is read from the environment only (never argv/committed). The
 * account starts without TOTP, so it can only complete TOTP enrollment.
 */
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { z } from 'zod';
import prisma from '../lib/db';
import { recordAuditEvent } from '../lib/auth/audit';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '../lib/auth/policy';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  if (!process.argv.includes('--confirm')) throw new Error('Refusing to run without --confirm.');
  const input = z
    .object({
      email: z.email().max(254),
      name: z.string().trim().min(1).max(200),
      password: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
    })
    .parse({ email: arg('email'), name: arg('name'), password: process.env.BOOTSTRAP_ADMIN_PASSWORD });

  const email = input.email.toLowerCase();
  if (await prisma.authUser.findUnique({ where: { email } })) throw new Error('An account with that email already exists.');

  const userId = randomUUID();
  const passwordHash = await hashPassword(input.password);
  await prisma.$transaction(async (tx) => {
    await tx.authUser.create({
      data: {
        id: userId,
        email,
        name: input.name,
        emailVerified: true,
        accounts: { create: { id: randomUUID(), accountId: userId, providerId: 'credential', password: passwordHash } },
        roleAssignments: { create: { role: 'ADMIN' } },
      },
    });
    await recordAuditEvent({ actorId: null, action: 'ADMIN_BOOTSTRAPPED', targetType: 'account', targetId: userId }, tx);
  });
  console.log(`Administrator created (${userId}). Sign in and complete TOTP enrollment.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof z.ZodError ? 'Invalid or missing input (email, name, BOOTSTRAP_ADMIN_PASSWORD).' : (error as Error).message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
