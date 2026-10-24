import type { KkPart } from './types';

/** KK3: Платформа, ИИ-агенты, филиалы, профиль, способы оплаты филиала. Ключ русская фраза, значение перевод; правка перевода меняет только значение */
export const platformOrg: KkPart = {
  paths: [
    'app/platform',
    'app/ai-agents',
    'app/branches',
    'app/profile',
    'app/branch-payment-methods',
  ],
  phrases: {},
};
