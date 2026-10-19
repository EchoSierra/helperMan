import type { ReactNode } from 'react';
import { requireMaintainerPage } from '@/lib/auth/page-guards';

export const dynamic = 'force-dynamic';

export default async function QualificationsLayout({ children }: { children: ReactNode }) {
  await requireMaintainerPage();
  return children;
}
