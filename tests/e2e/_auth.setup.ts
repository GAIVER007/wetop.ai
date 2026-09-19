import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { expect, test } from '@playwright/test';
import { createPrismaClient } from '@pms/database';
import { hashPassword } from '@pms/domain';
import { AUTH_STATE, E2E_PASSWORD, E2E_USER, SERVICE_KEY, SESSION_COOKIE } from '../tools/e2e-auth';

/**
 * Вход для прогона с включённым замком API (`E2E_AUTH=1`, порядок — `plans/slice-13-accounts-saas.md` §7а).
 *
 * Без этого шага включение `AUTH_REQUIRED=1` положило бы весь набор: спеки ходят по стойке без входа.
 * Здесь заводится сотрудник автотестов в схеме `pms_test` (ADR-010 — человек вымышленный), его сессия
 * кладётся в cookie стойки (`storageState`), а служебный ключ спеки шлют заголовком из конфига.
 *
 * Отдельно проверяется, что замок и правда включён: `reuseExistingServer` мог подобрать стенд от прежнего
 * прогона без замка, и тогда набор дал бы зелёное, ничего не доказав.
 */
test('вход сотрудника автотестов: замок включён, сессия в cookie стойки', async ({ request }) => {
  const api = process.env['APP_API_URL'] ?? '';
  expect(api, 'APP_API_URL не задан конфигом e2e').not.toBe('');

  const db = createPrismaClient();
  try {
    const organization =
      (await db.organization.findFirst({ orderBy: { createdAt: 'asc' } })) ??
      (await db.organization.create({ data: { name: 'WETOP (автотесты)', status: 'ACTIVE' } }));
    const user = await db.user.upsert({
      where: { email: E2E_USER.email },
      update: { passwordHash: hashPassword(E2E_PASSWORD), status: 'ACTIVE', failedAttempts: 0, lockedUntil: null },
      create: {
        email: E2E_USER.email,
        name: E2E_USER.name,
        status: 'ACTIVE',
        passwordHash: hashPassword(E2E_PASSWORD),
      },
    });
    const membership = await db.membership.findFirst({
      where: { userId: user.id, organizationId: organization.id },
    });
    if (!membership) await db.membership.create({ data: { userId: user.id, organizationId: organization.id } });
  } finally {
    await db.$disconnect();
  }

  // Стенд действительно под замком: запрос без токена и без служебного ключа обязан получить 401
  const naked = await request.get(`${api}/inventory/summary`, {
    headers: { 'x-wetop-service-key': '' },
  });
  expect(
    naked.status(),
    'API стенда отвечает без входа — значит замок выключен. Снимите процессы 3100/3101 от прежнего прогона и запустите снова',
  ).toBe(401);

  const key = process.env['SERVICE_API_KEY'] ?? '';
  expect(key, 'SERVICE_API_KEY не задан конфигом e2e').toBe(SERVICE_KEY);

  const login = await request.post(`${api}/auth/login`, {
    data: { email: E2E_USER.email, password: E2E_PASSWORD },
  });
  expect(login.status(), await login.text()).toBe(201);
  const session = (await login.json()) as { token: string; expiresAt: string };
  expect(session.token).toBeTruthy();

  mkdirSync(dirname(AUTH_STATE), { recursive: true });
  writeFileSync(
    AUTH_STATE,
    JSON.stringify({
      cookies: [
        {
          name: SESSION_COOKIE,
          value: session.token,
          domain: '127.0.0.1',
          path: '/',
          expires: Math.floor(new Date(session.expiresAt).getTime() / 1000),
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
        },
      ],
      origins: [],
    }),
  );
});
