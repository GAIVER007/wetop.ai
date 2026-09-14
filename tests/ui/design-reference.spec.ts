import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/**
 * Скриншоты текущих экранов для дизайн-системы (plans/design-system-2026-09-14.md, шаг 1).
 * Снимаются на синтетическом API с витриной крайних случаев (`showcase`): только там псевдонимы
 * гарантированы (ADR-010). Файлы — design/reference/current/<экран>-<тема>.png, 1440×1000.
 */
const fixture = 'http://127.0.0.1:4311';
const dir = 'design/reference/current';
const themes = ['light', 'dark'] as const;

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
  await request.post(`${fixture}/__test/control`, { data: { showcase: true } });
  mkdirSync(dir, { recursive: true });
});

async function theme(page: Page, name: (typeof themes)[number]) {
  await page.emulateMedia({ colorScheme: name });
}
async function shot(page: Page, name: string, themeName: string) {
  await expect(page.locator('html')).toHaveAttribute('data-theme', themeName);
  // Два снимка одного экрана должны совпадать попиксельно (scripts/design/src/compare-shots.ts):
  // курсор в угол, без каретки, переходы CSS доведены до конца, значок dev-оверлея Next спрятан.
  await page.mouse.move(0, 0);
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  await page.screenshot({ caret: 'hide', animations: 'disabled', path: `${dir}/${name}-${themeName}.png` });
}

for (const t of themes) {
  test(`шахматка: неделя и месяц (${t})`, async ({ page }) => {
    await theme(page, t);
    await page.goto('/chessboard');
    await expect(page.getByTestId('stay-cell').first()).toBeVisible();
    await expect(page.getByTestId('unassigned-stays')).toHaveAttribute('data-count', '1');
    await shot(page, 'chessboard-week', t);
    await page.getByRole('link', { name: 'Месяц', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Месяц', exact: true })).toHaveAttribute('aria-current', 'true');
    expect(await page.getByTestId('date-col').count()).toBeGreaterThanOrEqual(28);
    await shot(page, 'chessboard-month', t);
  });

  test(`обзор дня (${t})`, async ({ page }) => {
    await theme(page, t);
    await page.goto('/today');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Обзор дня');
    await shot(page, 'today', t);
  });

  test(`карточка брони панелью, четыре вкладки (${t})`, async ({ page }) => {
    await theme(page, t);
    await page.goto('/chessboard');
    await page.getByTestId('stay-cell').first().click();
    const drawer = page.getByRole('dialog', { name: 'Бронирование', exact: true });
    await expect(drawer).toBeVisible();
    const tabs = drawer.getByRole('tablist', { name: 'Разделы карточки брони' });
    for (const [id, name] of [
      ['overview', 'Обзор'],
      ['folios', 'Счета'],
      ['actions', 'Действия'],
      ['history', 'История'],
    ] as const) {
      const tab = tabs.getByRole('tab', { name, exact: true });
      if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      await shot(page, `booking-card-${id}`, t);
    }
  });

  test(`карточка гостя (${t})`, async ({ page }) => {
    await theme(page, t);
    await page.goto('/guests/ui-guest');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Гость');
    await shot(page, 'guest', t);
  });

  test(`форма брони: одно размещение и группа (${t})`, async ({ page }) => {
    await theme(page, t);
    await page.goto('/reservations/new?unit=M03');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Новая бронь');
    await shot(page, 'reservation-new', t);
    await page.getByLabel('Количество мест').first().fill('3');
    await expect(page.getByTestId('group-hint').first()).toBeVisible();
    await shot(page, 'reservation-new-group', t);
  });

  test(`цены и ограничения с массовым изменением (${t})`, async ({ page }) => {
    await theme(page, t);
    await page.goto('/rates');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Цены и ограничения');
    await expect(page.getByTestId('rates-table')).toBeVisible();
    await shot(page, 'rates', t);
    const editor = page.getByTestId('bulk-editor');
    await editor.getByLabel('Цена за ночь').fill('9100');
    await editor.getByRole('button', { name: '+ Добавить в список', exact: true }).click();
    await expect(page.getByTestId('pending-changes')).toContainText('9100');
    await shot(page, 'rates-bulk', t);
  });

  test(`журнал интеграции Channex (${t})`, async ({ page }) => {
    await theme(page, t);
    await page.goto('/channels');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Каналы продаж');
    await expect(page.getByTestId('events-table')).toContainText('booking_new');
    await shot(page, 'channels', t);
  });
}
