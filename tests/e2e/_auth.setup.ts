import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { expect, test } from '@playwright/test';
import { createPrismaClient } from '@pms/database';
import { hashPassword } from '@pms/domain';
import { AUTH_STATE, E2E_PASSWORD, E2E_USER, SERVICE_KEY, SESSION_COOKIE } from '../tools/e2e-auth';

/** Указатель рабочего филиала стойки (`apps/web/src/lib/scope-pointer.ts`) */
const SCOPE_COOKIE = 'wetop_scope';

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
test('вход сотрудника автотестов: замок включён, сессия и филиал в cookie стойки', async ({ request, page }) => {
  const api = process.env['APP_API_URL'] ?? '';
  expect(api, 'APP_API_URL не задан конфигом e2e').not.toBe('');

  const db = createPrismaClient();
  try {
    const property = await db.property.findFirst({
      where: { accommodationTypes: { some: {} } },
      orderBy: { name: 'asc' },
      select: { id: true, organizationId: true },
    });
    expect(property, 'В pms_test нет засеянного объекта').not.toBeNull();
    const organization = property!.organizationId
      ? await db.organization.findUniqueOrThrow({ where: { id: property!.organizationId } })
      : ((await db.organization.findFirst({ orderBy: { createdAt: 'asc' } })) ??
        (await db.organization.create({
          data: { name: 'WETOP (автотесты)', status: 'ACTIVE' },
        })));
    if (!property!.organizationId) {
      await db.property.update({
        where: { id: property!.id },
        data: { organizationId: organization.id },
      });
    }
    const user = await db.user.upsert({
      where: { email: E2E_USER.email },
      update: {
        passwordHash: hashPassword(E2E_PASSWORD),
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        failedAttempts: 0,
        lockedUntil: null,
      },
      create: {
        email: E2E_USER.email,
        name: E2E_USER.name,
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        passwordHash: hashPassword(E2E_PASSWORD),
      },
    });
    await db.membership.deleteMany({
      where: { userId: user.id, organizationId: { not: organization.id } },
    });
    // Владелец тестовой организации: спеки проходят всю стойку — тарифы, каналы, возвраты, журнал, а у администратора
    // их нет (роли — ADR-107, DATA_MODEL §16.5). Раньше членство заводилось без роли, то есть администратором
    await db.membership.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
      create: { userId: user.id, organizationId: organization.id, role: 'OWNER' },
      update: { role: 'OWNER' },
    });
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

  // Как после входа человека: сессия в cookie, затем `/scope/resolve` выбирает единственный филиал организации и
  // ставит его указатель. Без подтверждённого филиала стойка не выдаёт прав (MV8, PR #272), и спеки не видели бы
  // возвратов, сторно и журнала. Филиал выбирает сам сервер стойки, тест его не подставляет.
  await page.context().addCookies([
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
  ]);
  await page.goto('/scope/resolve');
  await expect(page).not.toHaveURL(/\/scope\/resolve|\/branches|#login/);
  const scope = (await page.context().cookies()).find((c) => c.name === SCOPE_COOKIE);
  expect(scope?.value, '/scope/resolve не выбрал филиал сотруднику автотестов').toBeTruthy();

  mkdirSync(dirname(AUTH_STATE), { recursive: true });
  await page.context().storageState({ path: AUTH_STATE });
});
