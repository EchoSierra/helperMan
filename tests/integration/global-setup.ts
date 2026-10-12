import { execFileSync } from 'node:child_process';

/** Applies migrations to the dedicated test database. Refuses anything not clearly a test database. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('Set TEST_DATABASE_URL to a dedicated, disposable test database.');
  const dbName = new URL(url).pathname.replace(/^\//, '');
  if (!/test/i.test(dbName)) throw new Error(`Refusing to run against "${dbName}": database name must contain "test".`);
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}
