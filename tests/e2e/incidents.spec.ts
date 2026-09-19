import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { expect, test } from '@playwright/test';
import { createPrismaClient } from '@pms/database';

/**
 * Срез 11, экран «Неисправности» (ADR-028). Проверяется итог в данных, а не надпись: «Принято» переводит
 * неисправность в ACKNOWLEDGED (сторож перестаёт будить), «Решено» закрывает её вручную (RESOLVED, STAFF),
 * и она уходит из открытых в «Закрыты за сутки».
 *
 * Неисправность создаётся прямо в таблице: API создания нарочно нет — писать туда может только сторож.
 * Вид `api.error` сторож сам не закрывает сутки (закрытие по тишине), поэтому проход раз в минуту тесту не
 * мешает. Строка своя на прогон (метка в отпечатке) и удаляется за собой.
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

test('неисправность на экране: «Принято» — сторож больше не будит, «Решено» — закрыта вручную', async ({
  page,
}) => {
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
  await expect(row).toContainText('код — исправляет дежурный агент');
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
