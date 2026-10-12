import { defineConfig } from 'vitest/config';
import path from 'node:path';

try {
  process.loadEnvFile(path.resolve(import.meta.dirname, '.env'));
} catch {
  // .env is optional; TEST_DATABASE_URL may come from the environment
}

export default defineConfig({
  envDir: path.resolve(import.meta.dirname, '.vitest-no-env'),
  resolve: { alias: { '@': path.resolve(import.meta.dirname) } },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.itest.ts'],
    setupFiles: ['tests/integration/setup-env.ts'],
    globalSetup: ['tests/integration/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
