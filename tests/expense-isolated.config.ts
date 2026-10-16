import { defineConfig } from 'vitest/config';
export default defineConfig({test:{projects:[{test:{name:'integration',include:['tests/integration/expense-documents-isolated.test.ts'],fileParallelism:false,hookTimeout:30000}}]}});
