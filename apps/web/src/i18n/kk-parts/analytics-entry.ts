import type { KkPart } from './types';

/** KK3: Аналитика, вход, регистрация, мастер создания, приглашение, первичная настройка. Ключ русская фраза, значение перевод; правка перевода меняет только значение */
export const analyticsEntry: KkPart = {
  paths: [
    'app/management',
    'app/register',
    'app/create',
    'app/login',
    'app/auth',
    'app/invite',
    'app/onboarding',
    'app/api',
  ],
  phrases: {},
};
