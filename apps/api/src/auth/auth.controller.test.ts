import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { AUTH_IP_LIMITS, AuthController } from './auth.controller';

/**
 * С-5 из ТЗ аудита 25.09.2026, вторая половина: на login/register/reset/resend не было лимитов
 * по адресу — перебор паролей и рассылка писем сдерживались только локаутом одной учётки.
 * Адрес посетителя берётся как у виджета (client-ip.ts): CF-Connecting-IP доверяется только
 * от туннеля; стойка пробрасывает его заголовком (apps/web `authHeaders`).
 */

const ATTACKER = '203.0.113.7';
const OTHER = '198.51.100.4';
const BODY = { email: 'guest@example.invalid', password: 'не тот' };

function make() {
  const calls = { login: 0, register: 0, reset: 0, resend: 0 };
  const auth = {
    async login() {
      calls.login += 1;
      throw new Error('Неверная почта или пароль');
    },
    assertRegistrationOpen() {},
    async register() {
      calls.register += 1;
      return { pendingVerification: true, email: BODY.email, name: 'Гость', sent: true };
    },
  };
  const reset = {
    async request() {
      calls.reset += 1;
    },
  };
  const verification = {
    async resend() {
      calls.resend += 1;
    },
  };
  const controller = new AuthController(
    auth as never,
    reset as never,
    verification as never,
    {} as never,
  );
  return { controller, calls };
}

describe('AuthController: лимиты попыток по адресу (С-5)', () => {
  it(`вход: после ${AUTH_IP_LIMITS.loginPerHour} попыток с одного адреса — «попробуйте позже», сервис не зовётся`, async () => {
    const { controller, calls } = make();
    for (let i = 0; i < AUTH_IP_LIMITS.loginPerHour; i += 1) {
      await expect(controller.login(BODY, undefined, ATTACKER)).rejects.toThrow(
        'Неверная почта или пароль',
      );
    }
    await expect(controller.login(BODY, undefined, ATTACKER)).rejects.toThrow(/попробуйте позже/);
    expect(calls.login).toBe(AUTH_IP_LIMITS.loginPerHour);
    // другой адрес лимитом нападающего не задет
    await expect(controller.login(BODY, undefined, OTHER)).rejects.toThrow(
      'Неверная почта или пароль',
    );
  });

  it('заголовку CF-Connecting-IP верим только от туннеля: с публичного сокета он адрес не выбирает', async () => {
    const { controller, calls } = make();
    // с туннеля (loopback) заголовок и есть адрес посетителя
    for (let i = 0; i < AUTH_IP_LIMITS.loginPerHour; i += 1) {
      await expect(controller.login(BODY, undefined, '127.0.0.1', ATTACKER)).rejects.toThrow(
        'Неверная почта или пароль',
      );
    }
    await expect(controller.login(BODY, undefined, '127.0.0.1', ATTACKER)).rejects.toThrow(
      /попробуйте позже/,
    );
    // тот же заголовок с публичного адреса считается по сокету, чужой лимит не наполняет
    await expect(controller.login(BODY, undefined, '203.0.113.99', ATTACKER)).rejects.toThrow(
      'Неверная почта или пароль',
    );
    expect(calls.login).toBe(AUTH_IP_LIMITS.loginPerHour + 1);
  });

  it('без адреса (юнит-тесты, локальные вызовы) лимит не мешает', async () => {
    const { controller, calls } = make();
    for (let i = 0; i < AUTH_IP_LIMITS.loginPerHour + 2; i += 1) {
      await expect(controller.login(BODY, undefined)).rejects.toThrow('Неверная почта или пароль');
    }
    expect(calls.login).toBe(AUTH_IP_LIMITS.loginPerHour + 2);
  });

  it('свои службы с туннеля без заголовка — не «посетитель 127.0.0.1»: стойку одним ведром не запереть', async () => {
    const { controller, calls } = make();
    for (let i = 0; i < AUTH_IP_LIMITS.loginPerHour + 2; i += 1) {
      await expect(controller.login(BODY, undefined, '127.0.0.1')).rejects.toThrow(
        'Неверная почта или пароль',
      );
    }
    expect(calls.login).toBe(AUTH_IP_LIMITS.loginPerHour + 2);
  });

  it('регистрация, «забыли пароль» и «выслать письмо заново» — свои лимиты по адресу', async () => {
    const { controller, calls } = make();
    for (let i = 0; i < AUTH_IP_LIMITS.registerPerHour; i += 1) {
      await controller.register({ ...BODY, name: 'Гость', hotelName: 'Гостиница' }, ATTACKER);
    }
    await expect(
      controller.register({ ...BODY, name: 'Гость', hotelName: 'Гостиница' }, ATTACKER),
    ).rejects.toThrow(/попробуйте позже/);
    expect(calls.register).toBe(AUTH_IP_LIMITS.registerPerHour);

    for (let i = 0; i < AUTH_IP_LIMITS.resetPerHour; i += 1) {
      await controller.requestReset({ email: BODY.email }, ATTACKER);
    }
    await expect(controller.requestReset({ email: BODY.email }, ATTACKER)).rejects.toThrow(
      /попробуйте позже/,
    );
    expect(calls.reset).toBe(AUTH_IP_LIMITS.resetPerHour);

    for (let i = 0; i < AUTH_IP_LIMITS.resendPerHour; i += 1) {
      await controller.resendEmail({ email: BODY.email }, ATTACKER);
    }
    await expect(controller.resendEmail({ email: BODY.email }, ATTACKER)).rejects.toThrow(
      /попробуйте позже/,
    );
    expect(calls.resend).toBe(AUTH_IP_LIMITS.resendPerHour);
    // лимиты раздельные: вход с этого адреса всё ещё отвечает по существу
    await expect(controller.login(BODY, undefined, ATTACKER)).rejects.toThrow(
      'Неверная почта или пароль',
    );
  });
});
