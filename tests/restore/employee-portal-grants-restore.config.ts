import { defineConfig } from 'vitest/config';

// Standalone opt-in rehearsal: do not run the shared integration globalSetup or load .env.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/restore/employee-portal-grants-restore.test.ts'],
    fileParallelism: false,
  },
});
