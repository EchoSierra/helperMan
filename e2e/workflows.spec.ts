import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { PASSWORD, newPage, withClientIp, hydrated, firstSignIn, prisma, resetDatabase, seedUser, signIn, signInWithPassword } from './support';

const ADMIN = 'admin@example.test';
const MAINT = 'maint@example.test';

test.describe.configure({ mode: 'serial' });
test.beforeEach(async ({ context }) => {
  await resetDatabase();
  await withClientIp(context);
});
test.afterAll(() => prisma.$disconnect());

test('sign-in requires TOTP enrollment before any protected page', async ({ page }) => {
  await seedUser(MAINT, ['MAINTAINER']);
  await signInWithPassword(page, MAINT);
  await page.waitForURL('**/mfa/enroll');
  await page.goto('/helpers');
  await hydrated(page);
  await expect(page.getByRole('heading', { name: 'Helpers', exact: true })).toBeHidden();
  await page.goto('/mfa/enroll');
  await hydrated(page);
  await page.getByLabel('Confirm your password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Start TOTP setup' }).click();
  await expect(page.getByLabel('Authenticator setup key')).toBeVisible();
});

test('wrong password and wrong TOTP code are rejected', async ({ page }) => {
  await seedUser(MAINT, ['MAINTAINER']);
  await signInWithPassword(page, MAINT, 'not the password');
  await expect(page.locator('p[role=alert]')).toContainText('Sign-in failed');
  await firstSignIn(page, MAINT);
  await page.context().clearCookies();
  await signInWithPassword(page, MAINT);
  await page.waitForURL('**/mfa/verify');
  await page.getByLabel('Six-digit authenticator code').fill('000000');
  await page.getByRole('button', { name: /verify/i }).click();
  await expect(page.locator('p[role=alert]')).toBeVisible();
});

test('Administrator creates a Maintainer who enrolls and manages helpers and qualifications', async ({ browser }) => {
  await seedUser(ADMIN, ['ADMIN', 'MAINTAINER']);
  const { context: adminCtx, page: admin } = await newPage(browser);
  await firstSignIn(admin, ADMIN);
  await admin.goto('/admin/maintainers');
  await hydrated(admin);
  await admin.getByLabel('Name').fill('Max Maintainer');
  await admin.getByLabel('Email').fill(MAINT);
  await admin.getByLabel('Initial password').fill(PASSWORD);
  await admin.getByRole('button', { name: 'Create Maintainer' }).click();
  await expect(admin.getByRole('status')).toContainText('Maintainer created');

  const { context: maintCtx, page: maint } = await newPage(browser);
  await firstSignIn(maint, MAINT);
  await expect(maint.getByRole('link', { name: 'Account management' })).toBeHidden();
  await maint.goto('/admin/maintainers');
  await hydrated(maint);
  await expect(maint.getByRole('heading', { name: 'Account management' })).toBeHidden();

  await maint.goto('/helpers/new');
  await hydrated(maint);
  await maint.getByLabel('First name').fill('Erika');
  await maint.getByLabel('Last name').fill('Musterfrau');
  await maint.getByRole('button', { name: /save|create|add/i }).click();
  await expect(maint.getByText('Erika Musterfrau').first()).toBeVisible();

  await maint.getByLabel('Qualification title').fill('First aid');
  const soon = new Date(Date.now() + 10 * 86400_000).toISOString().slice(0, 10);
  await maint.getByLabel('Valid through (optional)').fill(soon);
  await maint.getByRole('button', { name: 'Add qualification' }).click();
  await expect(maint.getByRole('button', { name: 'Save' })).toBeVisible();
  await expect(maint.getByLabel('Qualification title').first()).toHaveValue('First aid');

  await maint.goto('/reports/qualification-expiry');
  await hydrated(maint);
  await expect(maint.getByText('First aid').first()).toBeVisible();

  await adminCtx.close();
  await maintCtx.close();
});

test('Administrator without Maintainer role cannot reach helper data', async ({ page }) => {
  await seedUser(ADMIN, ['ADMIN']);
  await firstSignIn(page, ADMIN);
  await expect(page.getByRole('link', { name: 'Helper directory' })).toBeHidden();
  await page.goto('/helpers');
  await hydrated(page);
  await expect(page.getByRole('heading', { name: 'Helpers', exact: true })).toBeHidden();
  await page.goto('/admin/maintainers');
  await hydrated(page);
  await expect(page.getByRole('heading', { name: 'Account management' })).toBeVisible();
});

test('disabling an account ends the open session immediately', async ({ browser }) => {
  await seedUser(ADMIN, ['ADMIN', 'MAINTAINER']);
  await seedUser(MAINT, ['MAINTAINER']);
  const { context: maintCtx, page: maint } = await newPage(browser);
  await firstSignIn(maint, MAINT);
  await maint.goto('/helpers');
  await hydrated(maint);
  await expect(maint.getByRole('heading', { name: 'Helpers', exact: true })).toBeVisible();

  const { context: adminCtx, page: admin } = await newPage(browser);
  await firstSignIn(admin, ADMIN);
  await admin.goto('/admin/maintainers');
  await hydrated(admin);
  await admin.getByRole('row', { name: new RegExp(MAINT) }).getByRole('button', { name: 'Disable' }).click();
  await expect(admin.getByRole('status')).toContainText('disabled');

  await maint.goto('/helpers');
  await hydrated(maint);
  await expect(maint.getByRole('heading', { name: 'Helpers', exact: true })).toBeHidden();
  await adminCtx.close();
  await maintCtx.close();
});

test('recovered Administrator must re-enroll TOTP before access', async ({ page }) => {
  await seedUser(ADMIN, ['ADMIN', 'MAINTAINER']);
  await firstSignIn(page, ADMIN);
  await page.context().clearCookies();

  const NEW_PASSWORD = 'temporary password 12345';
  execFileSync('npx', ['tsx', 'scripts/recover-admin.ts', '--email', ADMIN, '--confirm'], {
    env: { ...process.env, RECOVER_ADMIN_PASSWORD: NEW_PASSWORD },
    stdio: 'pipe',
  });

  await signInWithPassword(page, ADMIN, NEW_PASSWORD);
  await page.waitForURL('**/mfa/enroll');
  await page.goto('/admin/maintainers');
  await hydrated(page);
  await expect(page.getByRole('heading', { name: 'Account management' })).toBeHidden();
  await page.goto('/mfa/enroll');
  await hydrated(page);
  await firstSignInEnroll(page, NEW_PASSWORD);
  await signOutAndBackIn(page, NEW_PASSWORD);
});

async function firstSignInEnroll(page: import('@playwright/test').Page, password: string) {
  const { enrollTotp } = await import('./support');
  await enrollTotp(page, ADMIN, password);
}

async function signOutAndBackIn(page: import('@playwright/test').Page, password: string) {
  await page.context().clearCookies();
  await signIn(page, ADMIN, password);
}

test('Administrator records retention schedules', async ({ page }) => {
  await seedUser(ADMIN, ['ADMIN']);
  await firstSignIn(page, ADMIN);
  await page.goto('/admin/retention');
  await hydrated(page);
  await expect(page.getByText('Not approved yet.')).toHaveCount(2);
  await page.getByLabel('Period (days) for Inactive helper records').fill('365');
  await page.getByLabel('Decision reference for Inactive helper records').fill('DPO-2026-04');
  await page.getByLabel('The organization has formally approved this schedule.').first().check();
  await page.getByRole('button', { name: 'Save Inactive helper records schedule' }).click();
  await expect(page.getByText('Schedule saved.')).toBeVisible();
  await expect(page.getByText(/Approved: 365 days · decision DPO-2026-04/)).toBeVisible();
});
