import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountsController } from '../accounts/accounts.controller';
import { AuthController } from './auth.controller';
import { SessionGuard } from './auth.guard';
import type { AuthService } from './auth.service';

/** Реальный guard и метаданные контроллера: вход не должен требовать уже существующего входа. */
describe('объединение входа по коду с включённым SessionGuard', () => {
  beforeEach(() => vi.stubEnv('AUTH_REQUIRED', '1'));
  afterEach(() => vi.unstubAllEnvs());

  function guardFor(method: keyof AccountsController) {
    const auth = { whoami: vi.fn(async () => null) } as unknown as AuthService;
    const context = {
      getHandler: () => AccountsController.prototype[method],
      getClass: () => AccountsController,
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
    } as unknown as ExecutionContext;
    return new SessionGuard(new Reflector(), auth).canActivate(context);
  }

  it.each(['requestCode', 'verify', 'inviteByToken', 'acceptInvite'] as const)(
    '%s доступен без сессии, проверку кода/ссылки выполняет сам обработчик',
    async (method) => {
      await expect(guardFor(method)).resolves.toBe(true);
    },
  );

  it.each(['createInvite', 'invites', 'sessions', 'logoutAll'] as const)(
    '%s остаётся закрыт без сессии',
    async (method) => {
      await expect(guardFor(method)).rejects.toThrow('Войдите в систему');
    },
  );

  /**
   * Регистрация переехала на AuthController вместе с решением владельца входить по паролю
   * (20.09.2026, ADR-053). Она обязана быть без замка по той же причине, что и вход: этим
   * маршрутом человек и заводится. Забыть здесь @Public — значит закрыть регистрацию совсем.
   */
  function authGuardFor(method: keyof AuthController) {
    const auth = { whoami: vi.fn(async () => null) } as unknown as AuthService;
    const context = {
      getHandler: () => AuthController.prototype[method],
      getClass: () => AuthController,
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
    } as unknown as ExecutionContext;
    return new SessionGuard(new Reflector(), auth).canActivate(context);
  }

  it.each(['login', 'register'] as const)(
    '%s на AuthController доступен без сессии',
    async (method) => {
      await expect(authGuardFor(method)).resolves.toBe(true);
    },
  );

  it('смена пароля на AuthController остаётся закрытой', async () => {
    await expect(authGuardFor('password')).rejects.toThrow('Войдите в систему');
  });
});
