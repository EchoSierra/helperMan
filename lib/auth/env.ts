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
