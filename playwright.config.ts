import { defineConfig } from '@playwright/test';
import { config } from 'dotenv';

config({ quiet: true });

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('Set TEST_DATABASE_URL to a dedicated, disposable test database.');
const dbName = new URL(url).pathname.replace(/^\//, '');
if (!/test/i.test(dbName)) throw new Error(`Refusing to run against "${dbName}": database name must contain "test".`);

// The app server and the test process must only ever see the test database.
process.env.DATABASE_URL = url;
const PORT = 3100;
const ORIGIN = `http://localhost:${PORT}`;
process.env.BETTER_AUTH_URL = ORIGIN;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  timeout: 60_000,
  use: { baseURL: ORIGIN, trace: 'retain-on-failure' },
  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: `${ORIGIN}/sign-in`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { ...(process.env as Record<string, string>), NEXT_DIST_DIR: '.next-e2e' },
  },
});
