export const LOCALES = ['en', 'de'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'locale';

// One JSON file per namespace in messages/<locale>/<namespace>.json.
export const NAMESPACES = [
  'common',
  'errors',
  'auth',
  'admin',
  'helpers',
  'qualifications',
  'organizations',
  'equipment',
  'audit',
  'profile',
  'reports',
] as const;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function matchAcceptLanguage(header: string | null): Locale {
  for (const part of (header ?? '').split(',')) {
    const tag = part.split(';')[0].trim().toLowerCase().split('-')[0];
    if (isLocale(tag)) return tag;
  }
  return DEFAULT_LOCALE;
}
