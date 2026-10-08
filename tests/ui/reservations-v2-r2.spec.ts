import type { APIRequestContext } from '@playwright/test';
import { FIXTURE_API, expect, test, type Page } from './fixtures';
import { mkdirSync, writeFileSync } from 'node:fs';

/**
 * «Брони v2», срез R2 (ADR-106, план `plans/reservations-v2-r2-2026-09-27.md`): отбор каталога на
 * сервере и в адресе. Быстрые виды, списки «Источник / Оплата / Размещение / Категория / Сортировка»,
 * основа даты, сахар ссылок Главной, чистый адрес после «Показать», пустое состояние. Снимает
 * стоп-гейт для владельца: обе темы, виды и отборы из поручения 27.09 (R3 без отдельного «да» не начинается).
 */
const fixture = FIXTURE_API;
const report = 'reports/reservations-v2-r2-2026-09-27';
const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
const add = (days: number) =>
  new Date(Date.parse(today) + days * 86400000).toISOString().slice(0, 10);

/** Витрина design-seed + групповая бронь (2 из 3 мест назначены) и неоплаченная — как в R1 */
async function seedShowcase(request: APIRequestContext) {
  await request.post(`${fixture}/__test/reset`);
  expect((await request.post(`${fixture}/__test/design-seed`)).ok()).toBe(true);
  const post = (data: Record<string, unknown>) =>
    request.post(`${fixture}/reservations`, { headers: { 'x-wetop-test-client': '1' }, data });
  const group = await post({
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
  });
  expect(group.ok()).toBe(true);
  const unpaid = await post({
    arrivalDate: today,
    departureDate: add(2),
    source: 'WHATSAPP',
    guest: { firstName: 'Неоплата', lastName: 'Проверочная' },
    items: [{ accommodationTypeCode: 'ROOM', quantity: 1, adults: 1, unitCode: 'R09' }],
  });
  expect(unpaid.ok()).toBe(true);
  return {
    group: ((await group.json()) as { confirmationNumber: string }).confirmationNumber,
    unpaid: ((await unpaid.json()) as { confirmationNumber: string }).confirmationNumber,
  };
}

const rows = (page: Page) => page.getByTestId('reservations-table').locator('tbody tr');
const numbers = async (page: Page) =>
  (await rows(page).locator('.dir-number').allTextContents()).map((t) => t.trim());

test.afterEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('R2: быстрые виды отбирают на сервере и живут в адресе', async ({ page, request }) => {
  const created = await seedShowcase(request);
  await page.goto('/reservations');
  const main = page.getByRole('main');
  const views = main.getByRole('navigation', { name: 'Быстрые виды' });
  await expect(views.getByRole('link', { name: 'По периоду', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await views.getByRole('link', { name: 'Будущие', exact: true }).click();
  await expect(page).toHaveURL(/view=future/);
  await expect(views.getByRole('link', { name: 'Будущие', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(main.getByTestId('directory-meta')).toContainText('в виде «Будущие»');
  for (const r of await rows(page).locator('.reservations-stay-dates time').first().all())
    expect((await r.getAttribute('datetime'))! > today).toBe(true);
  await expect(rows(page).filter({ hasText: 'Отменена' })).toHaveCount(0);

  await views.getByRole('link', { name: 'Проживают', exact: true }).click();
  await expect(page).toHaveURL(/view=inhouse/);
  const statuses = await rows(page).locator('.badge').allTextContents();
  expect(statuses.length).toBeGreaterThan(0);
  expect(new Set(statuses.map((s) => s.trim()))).toEqual(new Set(['Проживает']));

  await views.getByRole('link', { name: 'Требуют внимания', exact: true }).click();
  await expect(page).toHaveURL(/view=attention/);
  const attention = await numbers(page);
  // без размещения (группа, DSG-UNAS) и деньги к возврату (DSG-RFND) — существующие факты
  expect(attention).toEqual(
    expect.arrayContaining([created.group, expect.stringMatching(/DSG-UNAS$/)]),
  );
  expect(attention.some((n) => n.endsWith('DSG-RFND'))).toBe(true);
  // оплаченная без проблем бронь сюда не попадает
  expect(attention.some((n) => n.endsWith('DSG-RETD'))).toBe(false);

  await views.getByRole('link', { name: 'Сегодня', exact: true }).click();
  await expect(page).toHaveURL(/view=today/);
  // «Сегодня» — ближайший заезд первым
  const arrivals = await rows(page)
    .locator('.reservations-stay-dates time:first-child')
    .evaluateAll((els) => els.map((e) => e.getAttribute('datetime')!));
  expect(arrivals).toEqual([...arrivals].sort());
});

test('R2: сочетание условий через форму — чистый адрес, форма восстанавливается из адреса', async ({
  page,
  request,
}) => {
  await seedShowcase(request);
  await page.goto('/reservations?view=today');
  const main = page.getByRole('main');
  if (!(await main.getByLabel('Оплата', { exact: true }).isVisible()))
    await main.getByRole('button', { name: 'Фильтры', exact: true }).click();
  await main.getByLabel('Оплата', { exact: true }).selectOption('due');
  await main.getByLabel('Сортировка', { exact: true }).selectOption('arrival');
  await main.getByRole('button', { name: 'Показать', exact: true }).click();
  // пустые списки и умолчания в адрес не попадают: страница чистит адрес одним переходом
  await expect(page).toHaveURL(
    (u) => /payment=due/.test(u.search) && !/(source|allocation|category|date)=/.test(u.search),
  );
  await expect(page).toHaveURL(/view=today/);
  await expect(page).toHaveURL(/sort=arrival/);
  await expect(main.getByTestId('directory-meta')).toContainText('есть долг');
  for (const fin of await rows(page).locator('.reservations-fin').allTextContents())
    expect(fin).toMatch(/к оплате|не оплачено/);
  // адрес — источник правды: открыли его заново, форма та же
  await page.goto(page.url());
  await expect(main.getByLabel('Оплата', { exact: true })).toHaveValue('due');
  await expect(main.getByLabel('Сортировка', { exact: true })).toHaveValue('arrival');

  // источник подстрокой канала, как в поручении владельца: source=booking → Booking.com
  await page.goto(`/reservations?from=${add(-3)}&to=${add(30)}&source=booking`);
  await expect(main.getByLabel('Источник', { exact: true })).toHaveValue('Booking.com');
  const sources = await rows(page).locator('.source-tag').allTextContents();
  expect(sources.length).toBeGreaterThan(0);
  for (const s of sources) expect(s).toContain('Booking.com');
});

test('R2: ссылки Главной — заезды, выезды, к оплате, без размещения — и прежний ?date=день', async ({
  page,
  request,
}) => {
  const created = await seedShowcase(request);
  const main = page.getByRole('main');
  await page.goto('/reservations?arrival=today');
  await expect(main.getByTestId('directory-meta')).toContainText('с заездом');
  const arrivals = await rows(page)
    .locator('.reservations-stay-dates time:first-child')
    .evaluateAll((els) => els.map((e) => e.getAttribute('datetime')));
  expect(arrivals.length).toBeGreaterThan(0);
  expect(new Set(arrivals)).toEqual(new Set([today]));

  await page.goto('/reservations?departure=today');
  const departures = await rows(page)
    .locator('.reservations-stay-dates time:last-child')
    .evaluateAll((els) => els.map((e) => e.getAttribute('datetime')));
  expect(new Set(departures)).toEqual(new Set([today]));

  await page.goto('/reservations?payment=due');
  await expect(rows(page).filter({ hasText: created.unpaid })).toHaveCount(1);

  await page.goto('/reservations?allocation=missing');
  expect(await numbers(page)).toEqual(expect.arrayContaining([created.group]));
  await expect(rows(page).filter({ hasText: '⚠' })).toHaveCount(await rows(page).count());

  // «Все брони дня» Главной шлёт ?date=YYYY-MM-DD — это по-прежнему день
  await page.goto(`/reservations?date=${add(1)}`);
  await expect(main.getByTestId('directory-meta')).toContainText(' на ');
  await expect(main.getByRole('alert')).toHaveCount(0);
});

test('R2: пустой отбор объясняет условия и предлагает их убрать; неизвестное условие — ошибка', async ({
  page,
  request,
}) => {
  await seedShowcase(request);
  const main = page.getByRole('main');
  await page.goto('/reservations?view=inhouse&source=Hostelworld&payment=refunded');
  const empty = main.getByTestId('reservations-empty');
  await expect(empty).toContainText('Бронирований не найдено');
  await expect(main.getByTestId('directory-meta')).toContainText('в виде «Проживают»');
  await expect(main.getByTestId('directory-meta')).toContainText('Hostelworld');
  await empty.getByRole('link', { name: 'Убрать условия отбора', exact: true }).click();
  await expect(page).toHaveURL(
    (u) => /view=inhouse/.test(u.search) && !/(source|payment)=/.test(u.search),
  );
  await expect(rows(page).first()).toBeVisible();

  await page.goto('/reservations?payment=half');
  await expect(main.getByRole('alert')).toContainText('Неизвестное условие отбора');
  await expect(main.getByRole('button', { name: 'Показать', exact: true })).toBeEnabled();
});

test('R2: телефон — списки отбора за «Фильтрами», таблица в первом экране', async ({
  page,
  request,
}) => {
  await seedShowcase(request);
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto('/reservations');
  const main = page.getByRole('main');
  await expect(main.getByLabel('Оплата', { exact: true })).toBeHidden();
  expect((await rows(page).first().boundingBox())!.y).toBeLessThanOrEqual(450);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1);
  const toggle = main.getByRole('button', { name: 'Фильтры', exact: true });
  expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await toggle.click();
  await expect(main.getByLabel('Оплата', { exact: true })).toBeVisible();
  expect(
    (await main.getByLabel('Оплата', { exact: true }).boundingBox())!.height,
  ).toBeGreaterThanOrEqual(44);
  // заданный отбор не прячется
  await page.goto('/reservations?payment=due');
  await expect(main.getByLabel('Оплата', { exact: true })).toBeVisible();
  await expect(main.getByRole('button', { name: 'Фильтры: 1', exact: true })).toBeVisible();
});

for (const theme of ['light', 'dark'] as const) {
  test(`R2, стоп-гейт: снимки для владельца, ${theme}`, async ({ page, request }) => {
    test.setTimeout(180_000);
    await seedShowcase(request);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    const main = page.getByRole('main');
    mkdirSync(report, { recursive: true });
    const urls: string[] = [];
    const shot = async (name: string, path: string, expectRows = true) => {
      await page.goto(path);
      if (expectRows) await expect(rows(page).first()).toBeVisible();
      else await expect(main.getByTestId('reservations-empty')).toBeVisible();
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `${report}/${theme}-${name}.png`, caret: 'initial' });
      urls.push(`${name}: ${new URL(page.url()).pathname}${new URL(page.url()).search}`);
    };
    await shot('today', '/reservations?view=today');
    await shot('future', '/reservations?view=future');
    await shot('attention', '/reservations?view=attention');
    await shot('debt', '/reservations?payment=due&sort=debt');
    await shot('unassigned', '/reservations?allocation=missing');
    // комбинация — через форму, как это сделает смена: вид, оплата, сортировка, «Показать»
    await page.goto('/reservations?view=today');
    if (!(await main.getByLabel('Оплата', { exact: true }).isVisible()))
      await main.getByRole('button', { name: 'Фильтры', exact: true }).click();
    await main.getByLabel('Оплата', { exact: true }).selectOption('due');
    await main.getByLabel('Источник', { exact: true }).selectOption('WHATSAPP');
    await main.getByLabel('Сортировка', { exact: true }).selectOption('arrival');
    await main.getByRole('button', { name: 'Показать', exact: true }).click();
    await expect(page).toHaveURL(
      (u) =>
        /payment=due/.test(u.search) && !/(source|allocation|category|date)=(&|$)/.test(u.search),
    );
    await expect(rows(page).first()).toBeVisible();
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${report}/${theme}-combo.png`, caret: 'initial' });
    urls.push(
      `combo (после «Показать»): ${new URL(page.url()).pathname}${new URL(page.url()).search}`,
    );
    await shot('empty', '/reservations?view=inhouse&source=Hostelworld&payment=refunded', false);
    // телефон: «Фильтры» раскрыты заданным условием
    await page.setViewportSize({ width: 390, height: 1000 });
    await shot('390-debt', '/reservations?payment=due');
    writeFileSync(`${report}/urls-${theme}.txt`, `${urls.join('\n')}\n`);
  });
}
