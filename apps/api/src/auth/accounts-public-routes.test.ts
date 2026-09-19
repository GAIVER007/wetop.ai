import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountsController } from '../accounts/accounts.controller';
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

  it.each(['requestCode', 'register', 'verify', 'inviteByToken', 'acceptInvite'] as const)(
    '%s доступен без сессии, проверку кода/ссылки выполняет сам обработчик',
    async (method) => {
      await expect(guardFor(method)).resolves.toBe(true);
    },
  );

  it.each(['createInvite', 'invites'] as const)('%s остаётся закрыт без сессии', async (method) => {
    await expect(guardFor(method)).rejects.toThrow('Войдите в систему');
  });
});
