import prisma from '@/lib/db';
import { requireAdministrator } from '@/lib/auth/guards';

export type AccountSummary = {
  id: string;
  email: string;
  name: string;
  disabled: boolean;
  twoFactorEnabled: boolean;
  roles: string[];
};

const ACCOUNT_LIMIT = 200;

export async function listAccounts(): Promise<{ accounts: AccountSummary[]; currentUserId: string }> {
  const actor = await requireAdministrator();
  const users = await prisma.authUser.findMany({
    where: { roleAssignments: { some: {} } },
    orderBy: { email: 'asc' },
    take: ACCOUNT_LIMIT,
    select: {
      id: true,
      email: true,
      name: true,
      disabled: true,
      twoFactorEnabled: true,
      roleAssignments: { select: { role: true } },
    },
  });
  return {
    currentUserId: actor.userId,
    accounts: users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      disabled: user.disabled,
      twoFactorEnabled: user.twoFactorEnabled === true,
      roles: user.roleAssignments.map((assignment) => assignment.role),
    })),
  };
}
