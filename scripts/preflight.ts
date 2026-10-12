/** Production readiness gate. Exits non-zero while any blocker remains. */
import prisma from '../lib/db';
import { loadAuthEnv } from '../lib/auth/env';
import { retentionPolicyBlockers } from '../lib/auth/preflight-policy';

async function main() {
  const failures: string[] = [];
  try {
    loadAuthEnv();
  } catch (error) {
    failures.push((error as Error).message);
  }

  const admins = await prisma.authUser.count({
    where: {
      disabled: false,
      twoFactorEnabled: true,
      roleAssignments: { some: { role: 'ADMIN' } },
      twoFactor: { is: { verified: true } },
    },
  });
  if (admins < 2) failures.push(`Need at least 2 enabled Administrators with verified TOTP (found ${admins}).`);

  failures.push(...retentionPolicyBlockers(process.env));

  if (failures.length > 0) {
    for (const failure of failures) console.error(`BLOCKER: ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('Production preflight passed.');
  }
}

main().finally(() => prisma.$disconnect());
