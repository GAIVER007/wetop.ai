import { defineConfig } from 'vitest/config';

// Focused spec proof against an already provisioned owned pms_test schema.
// Deliberately no globalSetup: this runner never applies migrations or copies data.
export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    projects: [{ test: {
      name: 'integration', environment: 'node',
      include: ['tests/integration/employee-portal*.test.ts'],
      fileParallelism: false, hookTimeout: 60000,
      env: { DATABASE_SCHEMA: 'pms_test' },
    } }],
  },
});
