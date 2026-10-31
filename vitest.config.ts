import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['tests/**/*.test.{ts,tsx}'], pool: 'forks', maxWorkers: 1 },
});
