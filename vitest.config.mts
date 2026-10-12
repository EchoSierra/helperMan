import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  // Point at a nonexistent dir so Vite never loads a local .env file.
  envDir: path.resolve(import.meta.dirname, '.vitest-no-env'),
  resolve: { alias: { '@': path.resolve(import.meta.dirname) } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
