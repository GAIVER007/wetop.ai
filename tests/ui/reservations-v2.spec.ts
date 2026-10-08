import type { APIRequestContext } from '@playwright/test';
import { FIXTURE_API, expect, test, type Page } from './fixtures';
import { mkdirSync } from 'node:fs';

/**
 * «Брони v2», срез R1 (ADR-106, план `plans/reservations-v2-r1-2026-09-27.md`): раскладка и
 * иерархия таблицы. Проверяет критерии приёмки среза (§66.1–2, 8–9 ТЗ) и снимает стоп-гейт для
 * владельца: обе темы, десятки строк разных состояний — статусы словами о брони, долг,
 * «не оплачено», финансы отменённой брони («—» / «к возврату» / «возвращено» / «оплачено»),
 * «⚠ без ячейки», групповая бронь с частичным назначением, пометки «заезд/выезд сегодня»,
 * плотность, «только чтение» после пробного срока (ADR-102).
 */
const fixture = FIXTURE_API;
const report = 'reports/reservations-v2-r1-2026-09-27';
const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
const add = (days: number) =>
  new Date(Date.parse(today) + days * 86400000).toISOString().slice(0, 10);

/** Крайние случаи поверх фикстуры: витрина `design-seed` + групповая (2 из 3 мест назначены)
 * и неоплаченная брони; финансы отмены (DSG-CANC/RFND/RETD/CPAID) задаёт сама витрина */
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
      items: ['M07', 'M08', null].map((unitCode) => ({
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

/** Вход стойки — как в trial-read-only.spec: «только чтение» видит вошедший */
async function signIn(page: Page) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
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
  await expect(rowOf('20260913-TEST2')).toContainText('Не подтверждена');
  await expect(rowOf('DSG-CANC')).toContainText('Отменена');
  await expect(rowOf('DSG-NOSH')).toContainText('Незаезд');
  await expect(main.getByLabel('Статус брони').locator('option[value="CANCELLED"]')).toContainText(
    'Отменены',
  );

  // деньги: частичная оплата — «к оплате», созданная без оплат — «не оплачено»
  await expect(rowOf('20260913-TESTAA')).toContainText('к оплате');
  await expect(rowOf(created.unpaid)).toContainText('не оплачено');

  // финансы отменённой брони (§16): больше нет двусмысленного «Отменена | оплачено» —
  // пустой счёт «—», платёж остался «к возврату», возврат сделан «возвращено»,
  // начисление осталось и покрыто платежом — честное «оплачено» («удержан штраф» — только в R6, когда список узнает PENALTY)
  const finOf = (number: string) => rowOf(number).locator('.reservations-fin');
  await expect(finOf('DSG-CANC')).toHaveText('—');
  await expect(finOf('DSG-RFND')).toContainText('к возврату');
  await expect(finOf('DSG-RETD')).toHaveText('возвращено');
  await expect(finOf('DSG-CPAID')).toHaveText('оплачено');

  // групповая бронь: «3 размещения», у частично назначенной — число мест без ячейки (§23)
  await expect(rowOf(created.group)).toContainText('3 размещения');
  await expect(rowOf(created.group)).toContainText('⚠ 1 без размещения');
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

/**
 * «Только чтение» после пробного срока (ADR-102) на «Бронях»: чтение работает целиком, полоса
 * оболочки на месте, «Новой брони» нет. Сам запрет записи держит API (`auth.guard.test.ts`) —
 * страница ничего не реализует повторно, только не показывает действие, которого нельзя.
 */
test('R1: «только чтение» — список, поиск и карточка доступны, «Новой брони» нет, полоса на месте', async ({
  page,
  request,
}) => {
  await seedShowcase(request);
  await request.post(`${fixture}/__test/control`, { data: { orgTrialDays: 'ended' } });
  await signIn(page);
  await page.goto('/reservations');
  const main = page.getByRole('main');
  await expect(page.getByTestId('read-only-banner')).toContainText(
    'Пробный период закончился, оплатите подписку',
  );
  await expect(main.getByRole('link', { name: 'Новая бронь', exact: true })).toHaveCount(0);
  // чтение не сужено: таблица, чипы, поиск и карточка работают
  const table = main.getByTestId('reservations-table');
  await expect(table.locator('tbody tr').first()).toBeVisible();
  await expect(main.getByLabel('Статус брони')).toBeVisible();
  await main.getByLabel('Поиск броней').fill('Тестовый');
  await main.getByRole('button', { name: 'Показать', exact: true }).click();
  await expect(main.getByTestId('directory-meta')).toContainText('Тестовый');
  await page.getByRole('link', { name: 'Открыть бронь 20260913-TESTAA', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Бронирование', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.keyboard.press('Escape');
  mkdirSync(report, { recursive: true });
  await page.screenshot({ path: `${report}/read-only-1440.png`, caret: 'initial' });
});

for (const theme of ['light', 'dark'] as const) {
  test(`R1, стоп-гейт: снимки для владельца, ${theme}`, async ({ page, request }) => {
    test.setTimeout(120_000);
    const created = await seedShowcase(request);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/reservations');
    const main = page.getByRole('main');
    await expect(main.getByTestId('reservations-table')).toBeVisible();
    await page.mouse.move(0, 0);
    mkdirSync(report, { recursive: true });
    await page.screenshot({ path: `${report}/${theme}-1440.png`, caret: 'initial' });
    await page.screenshot({
      path: `${report}/${theme}-1440-full.png`,
      caret: 'initial',
      fullPage: true,
    });
    // таблица крупнее: снимок самого списка, без меню и шапки
    await main
      .locator('.reservations-list')
      .screenshot({ path: `${report}/${theme}-table-closeup.png` });
    // групповая бронь с частичным назначением — отдельной строкой крупно
    await main
      .getByTestId('reservations-table')
      .locator('tbody tr')
      .filter({ hasText: created.group })
      .screenshot({ path: `${report}/${theme}-group-row.png` });
    // отменённые и их финансы одним экраном (§16): «—», «к возврату», «возвращено», «оплачено»
    await page.goto('/reservations?status=CANCELLED');
    await expect(main.getByTestId('reservations-table').locator('tbody tr')).toHaveCount(4);
    await page.screenshot({ path: `${report}/${theme}-cancelled-finance.png`, caret: 'initial' });
    await page.goto('/reservations');
    await expect(main.getByTestId('reservations-table')).toBeVisible();
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.screenshot({ path: `${report}/${theme}-390.png`, caret: 'initial' });
  });
}
