import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountsModule } from '../accounts/accounts.module';
import { PlatformModule } from '../platform/platform.module';
import { PLATFORM_APP_URL } from '../platform/organization-creation';
import { AuthModule } from './auth.module';
import { APP_URL } from './password-reset.service';

/**
 * Адрес стойки в письмах (подтверждение почты, сброс пароля, приглашение, ссылка владельцу) один на все письма. До
 * 16.10.2026 приглашение читало `APP_URL` и без неё давало ссылку без адреса («/invite/…»), остальные письма читали
 * `PUBLIC_APP_URL` с запасным `https://app.wetop.ai`: при одной заданной переменной письма расходились.
 */
const MODULES: Array<[object, unknown]> = [
  [AuthModule, APP_URL],
  [AccountsModule, 'APP_URL'],
  [PlatformModule, PLATFORM_APP_URL],
];
const factories = () =>
  MODULES.map(([module, token]) => {
    const providers = Reflect.getMetadata('providers', module) as Array<{ provide?: unknown; useFactory?: () => string }>;
    const provider = providers.find((p) => p.provide === token);
    if (!provider?.useFactory) throw new Error(`no app url provider for ${String(token)}`);
    return provider.useFactory;
  });

describe('one app URL for every letter', () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    [{ PUBLIC_APP_URL: '', APP_URL: 'http://127.0.0.1:3461' }, 'http://127.0.0.1:3461'],
    [{ PUBLIC_APP_URL: 'https://desk.example.invalid', APP_URL: '' }, 'https://desk.example.invalid'],
    [{ PUBLIC_APP_URL: '', APP_URL: '' }, 'https://app.wetop.ai'],
  ])('%o gives %s to every letter', (env, expected) => {
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    expect(factories().map((f) => f())).toEqual([expected, expected, expected]);
  });
});
