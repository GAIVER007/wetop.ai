import { afterEach, expect, it, vi } from 'vitest';
import { authRequired } from './session';

afterEach(() => vi.unstubAllEnvs());

/**
 * Аудит 25.09 В-2 и 26.09: замок стойки снимался любым значением `APP_AUTH_REQUIRED`, кроме строки «1». Правило то
 * же, что у API: в боевом образе (NODE_ENV=production) замок включён, пока его не выключили явным «0»; непонятное
 * значение включает, а не снимает.
 */
it('в боевом образе без APP_AUTH_REQUIRED вход обязателен', () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('APP_AUTH_REQUIRED', '');
  expect(authRequired()).toBe(true);
});

it.each(['1', 'true', 'yes', ' 1 '])('значение «%s» вход включает', (value) => {
  vi.stubEnv('APP_AUTH_REQUIRED', value);
  expect(authRequired()).toBe(true);
});

it('явный «0» выключает вход и в боевом образе', () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('APP_AUTH_REQUIRED', '0');
  expect(authRequired()).toBe(false);
});

it('в разработке без переменной стойка работает без входа, как раньше', () => {
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('APP_AUTH_REQUIRED', '');
  expect(authRequired()).toBe(false);
});
