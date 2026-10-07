import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { expect, test } from './fixtures';
import { createPrismaClient } from '@pms/database';
import { hashPassword } from '@pms/domain';
import { E2E_PASSWORD, E2E_USER, SESSION_COOKIE, authRun } from '../tools/e2e-auth';

/**
 * Срез 11, экран «Неисправности» (ADR-028). Проверяется итог в данных, а не надпись: «Принято» переводит
 * неисправность в ACKNOWLEDGED (сторож перестаёт будить), «Решено» закрывает её вручную (RESOLVED, STAFF),
 * и она уходит из открытых в «Закрыты за сутки».
 *
 * Неисправность создаётся прямо в таблице: API создания нарочно нет — писать туда может только сторож.
 * Вид `api.error` сторож сам не закрывает сутки (закрытие по тишине), поэтому проход раз в минуту тесту не
 * мешает. Строка своя на прогон (метка в отпечатке) и удаляется за собой.
 *
 * Неисправности глобальные, у них нет организации: под замком их видит только главный администратор
 * (`IntegrationOwnerGuard`). Поэтому спек входит отдельным вымышленным главным администратором, а не делает им
 * общего сотрудника автотестов: соседние спеки идут в параллель и должны видеть стойку обычным владельцем.
 */
loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const db = createPrismaClient(process.env.DATABASE_URL);
const MARK = `E2E-АВТОТЕСТ ${Date.now().toString(36)}`;
const ROUTE = `GET /e2e/${MARK}`;
const FINGERPRINT = `api.error:${ROUTE}`;

test.afterAll(async () => {
  await db.systemIncident.deleteMany({ where: { fingerprint: FINGERPRINT } });
  await db.$disconnect();
});

const PLATFORM_ADMIN = { email: 'e2e-platform@example.invalid', name: 'Главный администратор автотестов' };

/** Сессия главного администратора в cookie стойки; без замка стенда вход не нужен */
async function signInPlatformAdmin(page: import('@playwright/test').Page): Promise<void> {
  if (!authRun()) return;
  const api = process.env['APP_API_URL'] ?? '';
  // организация та же, что у сотрудника автотестов из шага входа
  const desk = await db.user.findUniqueOrThrow({
    where: { email: E2E_USER.email },
    select: { memberships: { select: { organizationId: true }, take: 1 } },
  });
  const user = await db.user.upsert({
    where: { email: PLATFORM_ADMIN.email },
    update: { passwordHash: hashPassword(E2E_PASSWORD), status: 'ACTIVE', failedAttempts: 0, lockedUntil: null },
    create: {
      email: PLATFORM_ADMIN.email,
      name: PLATFORM_ADMIN.name,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      passwordHash: hashPassword(E2E_PASSWORD),
    },
  });
  const organizationId = desk.memberships[0]!.organizationId;
  await db.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId } },
    create: { userId: user.id, organizationId, role: 'OWNER' },
    update: { role: 'OWNER' },
  });
  await db.platformAdmin.upsert({
    where: { userId: user.id },
    create: { userId: user.id, note: 'e2e: глобальные неисправности' },
    update: { revokedAt: null },
  });
  const login = await page.request.post(`${api}/auth/login`, {
    data: { email: PLATFORM_ADMIN.email, password: E2E_PASSWORD },
  });
  expect(login.status(), await login.text()).toBe(201);
  const { token } = (await login.json()) as { token: string };
  await page.context().clearCookies({ name: SESSION_COOKIE });
  await page.context().addCookies([
    { name: SESSION_COOKIE, value: token, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' },
  ]);
}

test('неисправность на экране: «Принято» — сторож больше не будит, «Решено» — закрыта вручную', async ({
  page,
}) => {
  await signInPlatformAdmin(page);
  const inc = await db.systemIncident.create({
    data: {
      kind: 'api.error',
      class: 'C',
      severity: 'WARNING',
      fingerprint: FINGERPRINT,
      status: 'ESCALATED',
      title: `Ошибка программы (HTTP 500) на ${ROUTE}`,
      subjectType: 'route',
      subjectId: ROUTE,
    },
  });
  const statusOf = async () =>
    (await db.systemIncident.findUniqueOrThrow({ where: { id: inc.id } })).status;

  await page.goto('/incidents');
  const row = page.getByRole('main').locator(`[data-testid="incident-row"][data-id="${inc.id}"]`);
  await expect(row).toContainText(MARK);
  await expect(row).toContainText('Исправляет дежурный агент');
  await expect(row.getByTestId('incident-status')).toHaveText('ждёт человека');

  await row.getByTestId('incident-acknowledge').click();
  await expect(row.getByTestId('incident-status')).toHaveText('принято');
  await expect.poll(statusOf).toBe('ACKNOWLEDGED');
  await expect(row.getByTestId('incident-acknowledge')).toHaveCount(0);

  await row.getByTestId('incident-resolve').click();
  await expect(row).toHaveCount(0);
  await expect.poll(statusOf).toBe('RESOLVED');
  const closed = await db.systemIncident.findUniqueOrThrow({ where: { id: inc.id } });
  expect(closed.resolvedBy).toBe('STAFF');
  expect(closed.resolvedAt).not.toBeNull();
  await expect(page.getByRole('main').getByTestId('incidents-closed')).toContainText(MARK);
});
