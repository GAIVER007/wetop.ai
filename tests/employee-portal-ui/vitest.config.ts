import { defineConfig } from 'vitest/config';
// Own, already migrated synthetic database only. Avoid unrelated global hotel seed work.
export default defineConfig({ test: { projects: [{ test: { name: 'integration', environment: 'node', include: ['tests/integration/employee-portal.test.ts'], fileParallelism: false, maxWorkers: 1, hookTimeout: 30000, testTimeout: 15000 } }] } });
