import { getTranslations } from 'next-intl/server';
import { qualificationExpiryCsv } from '@/features/reports/qualification-expiry-csv';
import { exportQualificationExpiries } from '@/features/qualifications/service';
import { AuthError } from '@/lib/auth/errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const t = await getTranslations('reports');
    const items = await exportQualificationExpiries();
    return new Response(qualificationExpiryCsv(items, {
      headers: {
        helper: t('csv.headers.helper'),
        helperReference: t('csv.headers.helperReference'),
        qualification: t('csv.headers.qualification'),
        validThrough: t('csv.headers.validThrough'),
        status: t('csv.headers.status'),
      },
      inactiveLabel: t('report.inactive'),
      statusLabels: {
        Expired: t('statusLabels.Expired'),
        Expiring: t('statusLabels.Expiring'),
      },
    }), {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': 'attachment; filename="qualification-expiry.csv"',
        'Content-Type': 'text/csv; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.code }, { status: error.status });
    }
    throw error;
  }
}
