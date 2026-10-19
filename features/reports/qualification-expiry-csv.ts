import type { QualificationExpiryPage } from '@/features/qualifications/service';

type QualificationExpiryCsvLabels = {
  headers: {
    helper: string;
    helperReference: string;
    qualification: string;
    validThrough: string;
    status: string;
  };
  inactiveLabel: string;
  statusLabels: Record<'Expired' | 'Expiring', string>;
};

function escapeCsvValue(value: string): string {
  const safeValue = /^[\u0000-\u0020\u007f-\u009f\uFEFF]*[=+\-@]/u.test(value)
    ? `'${value}`
    : value;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

export function qualificationExpiryCsv(
  items: QualificationExpiryPage['items'],
  labels: QualificationExpiryCsvLabels,
): string {
  const headers = [
    labels.headers.helper,
    labels.headers.helperReference,
    labels.headers.qualification,
    labels.headers.validThrough,
    labels.headers.status,
  ];
  const rows = items.map((item) => [
    `${item.helperName}${item.helperActive ? '' : ` (${labels.inactiveLabel})`}`,
    item.helperId,
    item.qualificationTitle,
    item.validThrough,
    labels.statusLabels[item.status],
  ]);

  return `\uFEFF${[headers, ...rows].map((row) => row.map(escapeCsvValue).join(',')).join('\r\n')}\r\n`;
}
