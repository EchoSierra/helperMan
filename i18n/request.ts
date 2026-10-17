import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LOCALE, NAMESPACES, isLocale, matchAcceptLanguage, type Locale } from './config';

async function resolveLocale(): Promise<Locale> {
  const stored = (await cookies()).get('locale')?.value;
  if (isLocale(stored)) return stored;
  return matchAcceptLanguage((await headers()).get('accept-language')) ?? DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  const entries = await Promise.all(
    NAMESPACES.map(async (namespace) => [namespace, (await import(`../messages/${locale}/${namespace}.json`)).default] as const),
  );
  return { locale, messages: Object.fromEntries(entries) };
});
