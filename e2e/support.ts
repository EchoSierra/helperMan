import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import prisma from '@/lib/db';
import { totpFromBase32 } from '../tests/integration/totp';

// better-auth/crypto is ESM-only and Playwright loads specs as CommonJS.
const esmImport = new Function('specifier', 'return import(specifier)') as (s: string) => Promise<typeof import('better-auth/crypto')>;

export const PASSWORD = 'correct horse battery';
export { prisma };

/** Forms submitted before React hydrates fall back to a native post, so wait for the page to settle. */
export async function hydrated(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => {
    const forms = Array.from(document.querySelectorAll('form'));
    return forms.every((form) => Object.keys(form).some((key) => key.startsWith('__reactProps')));
  });
}

type Role = 'ADMIN' | 'MAINTAINER';

/** Resets the test database to a known state. Audit rows are append-only, so TRUNCATE. */
export async function resetDatabase() {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "audit_events"');
  await prisma.qualification.deleteMany();
  await prisma.helper.deleteMany();
  await prisma.authUser.deleteMany();
}

export async function seedUser(email: string, roles: Role[], password = PASSWORD) {
  const id = `e2e-${email.split('@')[0]}`;
  await prisma.authUser.create({
    data: {
      id,
      email,
      name: email.split('@')[0],
      emailVerified: true,
      roleAssignments: { create: roles.map((role) => ({ role })) },
      accounts: { create: { id: `${id}-acc`, accountId: id, providerId: 'credential', password: await (await esmImport('better-auth/crypto')).hashPassword(password) } },
    },
  });
  return id;
}

/** TOTP setup keys by account, captured at enrollment. */
const secrets = new Map<string, string>();

export async function signInWithPassword(page: Page, email: string, password = PASSWORD) {
  await page.goto('/sign-in');
  await hydrated(page);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
}

export async function enrollTotp(page: Page, email: string, password = PASSWORD) {
  await page.waitForURL('**/mfa/enroll');
  await hydrated(page);
  await page.getByLabel('Confirm your password').fill(password);
  await page.getByRole('button', { name: 'Start TOTP setup' }).click();
  const secret = (await page.getByLabel('Authenticator setup key').textContent())!.trim();
  secrets.set(email, secret);
  await page.getByLabel('Six-digit authenticator code').fill(totpFromBase32(secret));
  await page.getByRole('button', { name: 'Verify and finish setup' }).click();
  await expect(page.getByRole('heading', { name: 'Helper Manager' })).toBeVisible();
}

export async function verifyTotp(page: Page, email: string) {
  await page.waitForURL('**/mfa/verify');
  await hydrated(page);
  await page.getByLabel('Six-digit authenticator code').fill(totpFromBase32(secrets.get(email)!));
  await page.getByRole('button', { name: /verify/i }).click();
  await expect(page.getByRole('heading', { name: 'Helper Manager' })).toBeVisible();
}

/** First sign-in of a new account: password, then mandatory TOTP enrollment. */
export async function firstSignIn(page: Page, email: string, password = PASSWORD) {
  await signInWithPassword(page, email, password);
  await enrollTotp(page, email, password);
}

/** Later sign-in of an enrolled account: password, then TOTP code. */
export async function signIn(page: Page, email: string, password = PASSWORD) {
  await signInWithPassword(page, email, password);
  await verifyTotp(page, email);
}

let nextIp = 0;
/** The auth rate limiter keys on client IP; give every browser context its own so tests don't throttle each other. */
export function withClientIp(context: BrowserContext) {
  nextIp += 1;
  return context.setExtraHTTPHeaders({ 'x-forwarded-for': `10.9.${Math.floor(nextIp / 250)}.${(nextIp % 250) + 1}` });
}

export async function newPage(browser: Browser) {
  const context = await browser.newContext();
  await withClientIp(context);
  return { context, page: await context.newPage() };
}
