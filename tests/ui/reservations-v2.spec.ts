import type { APIRequestContext } from '@playwright/test';
import { expect, test } from './fixtures';
import { mkdirSync } from 'node:fs';

/**
 * «Брони v2», срез R1 (ADR-101, план `plans/reservations-v2-r1-2026-09-27.md`): раскладка и
 * иерархия таблицы. Проверяет критерии приёмки среза (§66.1–2, 8–9 ТЗ) и снимает стоп-гейт для
 * владельца: обе темы, десятки строк разных состояний — статусы словами о брони, долг,
 * «не оплачено», «⚠ без ячейки», групповая бронь, пометки «заезд/выезд сегодня», плотность.
 */
const fixture = 'http://127.0.0.1:4311';
const report = 'reports/reservations-v2-r1-2026-09-27';
const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
const add = (days: number) =>
  new Date(Date.parse(today) + days * 86400000).toISOString().slice(0, 10);

/** Крайние случаи поверх фикстуры: витрина `design-seed` + групповая и неоплаченная брони */
async function seedShowcase(request: APIRequestContext) {
  await request.post(`${fixture}/__test/reset`);
  const seeded = await request.post(`${fixture}/__test/design-seed`);
  expect(seeded.ok()).toBe(true);
  const group = await request.post(`${fixture}/reservations`, {
    headers: { 'x-wetop-test-client': '1' },
    data: {
      arrivalDate: today,
      departureDate: add(2),
      source: 'DESK',
      guest: { firstName: 'Группа', lastName: 'Туристов' },
      items: ['M07', 'M08', 'M09'].map((unitCode) => ({
        accommodationTypeCode: 'MALE',
        quantity: 1,
        adults: 1,
        unitCode,
      })),
    },
  });
  expect(group.ok()).toBe(true);
  const unpaid = await request.post(`${fixture}/reservations`, {
    headers: { 'x-wetop-test-client': '1' },
    data: {
      arrivalDate: today,
      departureDate: add(2),
      source: 'WHATSAPP',
      guest: { firstName: 'Неоплата', lastName: 'Проверочная' },
      items: [{ accommodationTypeCode: 'ROOM', quantity: 1, adults: 1, unitCode: 'R09' }],
    },
  });
  expect(unpaid.ok()).toBe(true);
  return {
    group: ((await group.json()) as { confirmationNumber: string }).confirmationNumber,
    unpaid: ((await unpaid.json()) as { confirmationNumber: string }).confirmationNumber,
  };
}

test.afterEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('R1: панель в две строки, таблица в первом экране, финансы и статус словами о брони', async ({
  page,
  request,
}) => {
  const created = await seedShowcase(request);
  // Окно «Сегодня» (по умолчанию): витрина design-seed занимает следующий месяц всеми 88 ячейками,
  // и период через границу месяца уводит целевые строки на вторую страницу
  await page.goto('/reservations');
  const main = page.getByRole('main');
  const table = main.getByTestId('reservations-table');
  await expect(table).toBeVisible();

  // §66.1: таблица начинается в первом viewport (1440×1000), панель фильтров компактна
  const firstRow = await table.locator('tbody tr').first().boundingBox();
  expect(firstRow!.y).toBeLessThanOrEqual(480);
  // «С / По» спрятаны за «Даты» при готовом отрезке (§62) — и раскрываются по кнопке
  await expect(main.getByLabel('Период: с')).toBeHidden();
  await main.getByRole('button', { name: 'Даты', exact: true }).click();
  await expect(main.getByLabel('Период: с')).toBeVisible();
  await main.getByRole('button', { name: 'Даты', exact: true }).click();

  // §66.8: финансы — одна колонка; отдельных «Стоимость» и «К оплате» больше нет
  const headers = table.locator('thead th');
  await expect(headers).toHaveCount(6);
  await expect(headers.nth(4)).toHaveText('Финансы');
  await expect(headers.filter({ hasText: 'К оплате' })).toHaveCount(0);

  // статус — слово о брони в единственном числе (Q-135); чипы фильтра остаются во множественном
  const rowOf = (number: string) => table.locator('tbody tr').filter({ hasText: number });
  await expect(rowOf('20260913-TEST2')).toContainText('не подтверждена');
  await expect(rowOf('DSG-CANC')).toContainText('отменена');
  await expect(rowOf('DSG-NOSH')).toContainText('незаезд');
  await expect(
    main.getByRole('navigation', { name: 'Статусы броней' }).getByRole('link', {
      name: /^Отменены/,
    }),
  ).toBeVisible();

  // деньги: частичная оплата — «к оплате», созданная без оплат — «не оплачено»
  await expect(rowOf('20260913-TESTAA')).toContainText('к оплате');
  await expect(rowOf(created.unpaid)).toContainText('не оплачено');

  // групповая бронь — «3 размещения» (§23), проживание без ячейки — «⚠ без ячейки» словом §9
  await expect(rowOf(created.group)).toContainText('3 размещения');
  await expect(rowOf('DSG-UNAS')).toContainText('без ячейки');

  // вычисляемые пометки дня (§12): не новые статусы, а взгляд стойки на дату
  await expect(rowOf('20260913-TESTAA')).toContainText('заезд сегодня');
  await expect(rowOf('20260913-TEST3')).toContainText('выезд сегодня');
});

test('R1: плотность строк переключается и переживает перезагрузку', async ({ page, request }) => {
  await seedShowcase(request);
  await page.goto('/reservations');
  const main = page.getByRole('main');
  const row = main.getByTestId('reservations-table').locator('tbody tr').first();
  const normal = (await row.boundingBox())!.height;
  await main.getByRole('button', { name: 'Компактно', exact: true }).click();
  await expect(main.getByRole('button', { name: 'Компактно', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const compact = (await row.boundingBox())!.height;
  expect(compact).toBeLessThan(normal);
  await page.reload();
  await expect(main.getByRole('button', { name: 'Компактно', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

for (const theme of ['light', 'dark'] as const) {
  test(`R1, стоп-гейт: снимки для владельца, ${theme}`, async ({ page, request }) => {
    test.setTimeout(120_000);
    await seedShowcase(request);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/reservations');
    const main = page.getByRole('main');
    await expect(main.getByTestId('reservations-table')).toBeVisible();
    await page.mouse.move(0, 0);
    mkdirSync(report, { recursive: true });
    await page.screenshot({ path: `${report}/${theme}-1440.png`, caret: 'initial' });
    await page.screenshot({ path: `${report}/${theme}-1440-full.png`, caret: 'initial', fullPage: true });
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.screenshot({ path: `${report}/${theme}-390.png`, caret: 'initial' });
  });
}
