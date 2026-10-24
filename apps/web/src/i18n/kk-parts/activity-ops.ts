import type { KkPart } from './types';

/** KK3: История действий, неисправности, задачи, отзывы, зарплата, склад, служебные экраны. Ключ русская фраза, значение перевод; правка перевода меняет только значение */
export const activityOps: KkPart = {
  paths: [
    'app/journal',
    'app/incidents',
    'app/tasks',
    'app/reviews',
    'app/specialists',
    'app/warehouse',
    'app/payroll',
    'app/status',
    'app/rate',
    'components/employee-workspace',
    'app/@drawer',
    'app/not-found.tsx',
    'app/loading.tsx',
    'app/error.tsx',
    'app/onboarding-gate.tsx',
  ],
  phrases: {},
};
