import { isIP } from 'node:net';
import { z } from 'zod';

const authEnvSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  BETTER_AUTH_URL: z.url(),
});

export type AuthEnv = z.infer<typeof authEnvSchema>;

/** Fails fast with names of invalid variables only; never echoes values. */
export function loadAuthEnv(source: Record<string, string | undefined> = process.env): AuthEnv {
  const result = authEnvSchema.safeParse(source);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
    throw new Error(`Invalid authentication configuration: ${names.join(', ')}`);
  }
  if (source.NODE_ENV === 'production' && new URL(result.data.BETTER_AUTH_URL).protocol !== 'https:') {
    throw new Error('Invalid authentication configuration: BETTER_AUTH_URL must use HTTPS in production');
  }
  return result.data;
}

/** Comma-separated proxy IPs/CIDRs from TRUSTED_PROXIES; undefined when unset. */
export function parseTrustedProxies(source: Record<string, string | undefined> = process.env): string[] | undefined {
  const entries = (source.TRUSTED_PROXIES ?? '').split(',').map((entry) => entry.trim()).filter(Boolean);
  if (entries.length === 0) return undefined;
  const valid = (entry: string) => {
    const [address, prefix, ...rest] = entry.split('/');
    const version = isIP(address);
    if (!version || rest.length > 0) return false;
    return prefix === undefined || (/^\d{1,3}$/.test(prefix) && Number(prefix) <= (version === 4 ? 32 : 128));
  };
  if (!entries.every(valid)) throw new Error('Invalid authentication configuration: TRUSTED_PROXIES');
  return entries;
}
