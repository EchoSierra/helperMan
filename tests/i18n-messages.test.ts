import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NAMESPACES } from '@/i18n/config';

function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key));
}

function load(locale: string, namespace: string): unknown {
  return JSON.parse(readFileSync(join(process.cwd(), 'messages', locale, `${namespace}.json`), 'utf8'));
}

describe('i18n messages', () => {
  it.each(NAMESPACES)('%s has identical keys in en and de', (namespace) => {
    expect(keys(load('de', namespace)).sort()).toEqual(keys(load('en', namespace)).sort());
  });
});
