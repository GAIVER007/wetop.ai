import { defineConfig } from 'vitest/config';

/** Separate loopback acceptance: no copying the working hotel's data into a test schema. */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'integration',
          include: [
            'tests/integration/wizard-drafts.test.ts',
            'tests/integration/wizard-claim.test.ts',
          ],
          fileParallelism: false,
        },
      },
    ],
  },
});
