import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { api, seed } from './tz11-helpers';
const evidence = process.env.ZAPIS_EVIDENCE || 'test-results/zapis-report';
test.use({ actionTimeout: 15000, reducedMotion: 'reduce' });

test('salon hours: break restricts new bookings and reports existing conflicts', async ({
  page,
  request,
}) => {
  const f = await seed(page, request);
  // Conflicts list only visits that have not ended yet, so the conflicting visit must be in the future:
  // the next Monday at least a week ahead (the break is configured for Monday).
  const monday = new Date(Date.now() + 7 * 86_400_000);
  while (monday.getUTCDay() !== 1) monday.setUTCDate(monday.getUTCDate() + 1);
  const day = monday.toISOString().slice(0, 10);
  await f.call('/beauty/appointments', {
    employeeId: f.employees[0]!.id,
    serviceId: f.services[0]!.id,
    startsAt: `${day}T12:00:00+05:00`,
    firstName: 'Тестовый конфликт часов',
  });
  try {
    await page.goto('/beauty-settings');
    await expect(page.getByText(/Режим пока не настроен/)).toBeVisible();
    await page.getByRole('button', { name: 'Добавить интервал: Понедельник', exact: true }).click();
    await page.getByLabel('Начало: Понедельник, интервал 1', { exact: true }).fill('09:00');
    await page.getByLabel('Конец: Понедельник, интервал 1', { exact: true }).fill('12:00');
    await page.getByRole('button', { name: 'Добавить интервал: Понедельник', exact: true }).click();
    await page.getByLabel('Начало: Понедельник, интервал 2', { exact: true }).fill('13:00');
    await page.getByLabel('Конец: Понедельник, интервал 2', { exact: true }).fill('17:00');
    await page.getByRole('button', { name: 'Сохранить режим', exact: true }).click();
    await expect(
      page.getByText('Режим работы сохранён. Существующие записи не перенесены.', { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('region', { name: 'Записи вне нового режима' })).toContainText(
      'Тестовый конфликт часов',
    );
    const blocked = await request.post(`${api}/beauty/appointments`, {
      headers: f.headers,
      data: {
        startsAt: `${day}T12:30:00+05:00`,
        firstName: 'Тестовый новый клиент',
        items: [{ employeeId: f.employees[1]!.id, serviceId: f.services[0]!.id }],
      },
    });
    expect(blocked.status()).toBe(409);
    mkdirSync(evidence, { recursive: true });
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        await page.screenshot({
          path: `${evidence}/salon-hours-${width}-${colorScheme}.png`,
          fullPage: true,
        });
      }
    }
    await page.goto(`/calendar?date=${day}`);
    await expect(
      page.getByRole('button', { name: /Тестовый конфликт часов/ }),
    ).toBeVisible();
    const response = await request.get(`${api}/beauty/appointments?date=${day}`, {
      headers: f.headers,
    });
    const data = await response.json();
    expect(data.columns[0].intervals).toEqual([
      { timeFrom: '09:00', timeTo: '12:00' },
      { timeFrom: '13:00', timeTo: '17:00' },
    ]);
  } finally {
    await request.post(`${api}/__test/cleanup`);
  }
});
