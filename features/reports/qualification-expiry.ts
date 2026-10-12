export type QualificationExpiryStatus = 'Expired' | 'Expiring';

export type QualificationExpiryWindow = {
  today: string;
  through: string;
};

function utcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getQualificationExpiryWindow(now: Date = new Date()): QualificationExpiryWindow {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const through = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 90));
  return { today: utcDateString(today), through: utcDateString(through) };
}

export function getQualificationExpiryStatus(
  validThrough: string,
  today: string,
  through: string,
): QualificationExpiryStatus | null {
  if (validThrough < today) return 'Expired';
  if (validThrough <= through) return 'Expiring';
  return null;
}

export function dateOnlyToUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
