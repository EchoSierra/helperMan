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

  if (!process.env.TRUSTED_PROXIES?.trim()) {
    failures.push('TRUSTED_PROXIES is not set; sign-in rate limiting could be bypassed with a spoofed X-Forwarded-For header.');
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

  const policies = await prisma.retentionPolicy.findMany({ select: { kind: true } });
  failures.push(...retentionPolicyBlockers(policies.map((policy) => policy.kind)));

  if (failures.length > 0) {
    for (const failure of failures) console.error(`BLOCKER: ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('Production preflight passed.');
  }
}

main().finally(() => prisma.$disconnect());
