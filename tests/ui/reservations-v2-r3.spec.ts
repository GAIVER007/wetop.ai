import type { APIRequestContext } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { mkdirSync } from 'node:fs';

/**
 * «Брони v2», срез R3 (ADR-106, план `plans/reservations-v2-r3-2026-09-28.md`): быстрый просмотр брони.
 * Строка открывает панель щелчком по любой ячейке, двойной щелчок — полная страница; в панели телефон
 * скрыт, есть «Финансы» и «Открыть бронь»; «Оплата» на полосе теми же словами, что колонка списка.
 * Панель — одобренная карточка B3: её вкладки и полосу держит `manager-actions.spec.ts`.
 */
// Порт стенда можно задать (`UI_FIXTURE_API`): дерево делят несколько сессий, 4311 бывает занят
const fixture = process.env['UI_FIXTURE_API'] ?? 'http://127.0.0.1:4311';
const report = 'reports/reservations-v2-r3-2026-09-28';
const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
const add = (days: number) =>
  new Date(Date.parse(today) + days * 86400000).toISOString().slice(0, 10);

/** Витрина design-seed + групповая бронь (2 из 3 мест) и неоплаченная с телефоном (вымышленный, ADR-010) */
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
    guest: { firstName: 'Неоплата', lastName: 'Проверочная', phone: '+7 701 000 00 12' },
    items: [{ accommodationTypeCode: 'ROOM', quantity: 1, adults: 1, unitCode: 'R09' }],
  });
  expect(unpaid.ok()).toBe(true);
  return {
    group: ((await group.json()) as { confirmationNumber: string }).confirmationNumber,
    unpaid: ((await unpaid.json()) as { confirmationNumber: string }).confirmationNumber,
  };
}

const rowOf = (page: Page, number: string) =>
  page.getByTestId('reservations-table').locator('tbody tr').filter({ hasText: number });
const drawerOf = (page: Page) => page.getByRole('dialog', { name: 'Бронирование', exact: true });

test.afterEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('R3: щелчок по любой ячейке открывает просмотр — телефон скрыт, финансы, «Открыть бронь», «Назад» в тот же список', async ({
  page,
  request,
}) => {
  const created = await seedShowcase(request);
  await page.goto('/reservations?view=today');
  const listUrl = page.url();
  // щелчок по ячейке «Финансы» — не по ссылке первой колонки
  await rowOf(page, created.unpaid).locator('.reservations-fin').click();
  const drawer = drawerOf(page);
  await expect(drawer).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/reservations/${created.unpaid}$`));
  const head = drawer.getByTestId('booking-head');
  await expect(head).toContainText('+7 *** *** ** 12');
  await expect(head).not.toContainText('701 000');
  await expect(head.getByRole('link', { name: 'Позвонить', exact: true })).toHaveAttribute(
    'href',
    /^tel:/,
  );
  await expect(head.getByRole('link', { name: 'WhatsApp', exact: true })).toBeVisible();
  // «Оплата» — слова колонки «Финансы» списка
  await expect(head.getByTestId('booking-due')).toHaveText('не оплачено');
  const finance = drawer.getByTestId('preview-finance');
  await expect(finance).toContainText('Итого');
  await expect(finance).toContainText('Оплачено');
  await expect(finance).toContainText('Возвращено');
  // прежние вкладки действий на месте (решение владельца 28.09: до R4)
  for (const tab of ['Обзор', 'Счета', 'Действия', 'История'])
    await expect(drawer.getByRole('tab', { name: tab, exact: true })).toBeVisible();

  // «Открыть бронь» — полная страница вместо панели, номер там целиком
  await drawer.getByRole('link', { name: 'Открыть бронь', exact: true }).click();
  await expect(drawerOf(page)).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/reservations/${created.unpaid}$`));
  await expect(page.getByRole('main').getByTestId('booking-head')).toContainText(
    '+7 701 000 00 12',
  );
  // в истории «список → бронь»: «Назад» ведёт в тот же отобранный список, а не в панель и не снова в бронь
  await page.goBack();
  await expect(page).toHaveURL(listUrl);
  await expect(page.getByTestId('reservations-table')).toBeVisible();
});

test('R3: двойной щелчок — полная страница; ссылка первой ячейки и Esc работают как раньше', async ({
  page,
  request,
}) => {
  const created = await seedShowcase(request);
  await page.goto('/reservations?view=today');
  await rowOf(page, created.unpaid).locator('.reservations-stay-dates').dblclick();
  await expect(page).toHaveURL(new RegExp(`/reservations/${created.unpaid}$`));
  await expect(page.getByRole('heading', { level: 1 })).toContainText(created.unpaid);
  await expect(drawerOf(page)).toHaveCount(0);

  await page.goto('/reservations?view=today');
  const opener = page.getByRole('link', { name: `Открыть бронь ${created.unpaid}` });
  await opener.focus();
  await page.keyboard.press('Enter');
  await expect(drawerOf(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(drawerOf(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/reservations\?view=today$/);
  await expect(opener).toBeFocused();
});

test('R3: отменённая — «к возврату» и «возвращено», а не «оплачено»; группа — «⚠ 1 без размещения»', async ({
  page,
  request,
}) => {
  const created = await seedShowcase(request);
  await page.goto('/reservations?status=CANCELLED');
  await rowOf(page, 'DSG-RFND').locator('.reservations-fin').click();
  await expect(drawerOf(page).getByTestId('booking-due')).toContainText('к возврату');
  await page.keyboard.press('Escape');
  await rowOf(page, 'DSG-RETD').locator('.reservations-fin').click();
  await expect(drawerOf(page).getByTestId('booking-due')).toHaveText('возвращено');
  await page.keyboard.press('Escape');

  await page.goto('/reservations?view=today');
  await rowOf(page, created.group).locator('.source-tag').click();
  const drawer = drawerOf(page);
  await expect(drawer.getByTestId('booking-place')).toContainText('⚠ 1 без размещения');
  await expect(drawer.getByTestId('stays-table').getByTestId('stay-row')).toHaveCount(3);
});

for (const theme of ['light', 'dark'] as const) {
  test(`R3, стоп-гейт: снимки для владельца, ${theme}`, async ({ page, request }) => {
    test.setTimeout(120_000);
    const created = await seedShowcase(request);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    mkdirSync(report, { recursive: true });
    // на телефоне низ карточки может уйти под нижнюю навигацию — щёлкаем по датам, они выше
    const shot = async (name: string, list: string, number: string, cell = '.reservations-fin') => {
      await page.goto(list);
      await rowOf(page, number).locator(cell).click();
      await expect(drawerOf(page).getByTestId('booking-head')).toBeVisible();
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `${report}/${theme}-${name}.png`, caret: 'initial' });
    };
    await shot('preview-unpaid', '/reservations?view=today', created.unpaid);
    await shot('preview-due', '/reservations?view=today', '20260913-TESTAA');
    await shot('preview-group', '/reservations?view=today', created.group);
    await shot('preview-refund', '/reservations?status=CANCELLED', 'DSG-RFND');
    // строка под курсором — подсветка при наведении
    await page.goto('/reservations?view=today');
    await rowOf(page, '20260913-TESTAA').hover();
    await page.screenshot({ path: `${report}/${theme}-row-hover.png`, caret: 'initial' });
    await page.setViewportSize({ width: 390, height: 1000 });
    await shot(
      '390-preview',
      '/reservations?view=today',
      created.unpaid,
      '.reservations-stay-dates',
    );
  });
}
