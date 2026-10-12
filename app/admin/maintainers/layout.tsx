import type { ReactNode } from 'react';
import { requireAdministratorPage } from '@/lib/auth/page-guards';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdministratorPage();
  return children;
}
