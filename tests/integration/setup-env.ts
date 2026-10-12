// Runs before every test file's imports, so the Prisma client can only ever see the test database.
const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('Set TEST_DATABASE_URL to a dedicated, disposable test database.');
const dbName = new URL(url).pathname.replace(/^\//, '');
if (!/test/i.test(dbName)) throw new Error(`Refusing to run against "${dbName}": database name must contain "test".`);
process.env.DATABASE_URL = url;
process.env.BETTER_AUTH_SECRET = 'x'.repeat(40);
process.env.BETTER_AUTH_URL = 'http://localhost:3000';
