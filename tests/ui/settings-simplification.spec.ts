import { FIXTURE_API, expect, test, devNoise } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

const API = FIXTURE_API;
test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

test('короткое меню настроек ведёт в единый объект с рабочими внутренними разделами', async ({
  page,
}) => {
  await page.goto('/hotel-settings');
  const sidebar = page.locator('.workspace-header .topmenu');
  const group = sidebar
    .locator('.topmenu__group')
    .filter({ has: page.getByRole('button', { name: 'Настройки', exact: true }) });
  // Сайт объекта в «Маркетинг → Сайт и SEO» (MKT2; до 06.10 в «Продажах», ADR-117), в «Настройках» его больше нет
  await expect(group.locator('a')).toHaveText([
    'Объект',
    'Сотрудники и доступ',
    'Подключения',
    'Журнал операций',
    'Неисправности',
  ]);
  await expect(page.getByTestId('stored-property')).toContainText('Luxx Aparts');
  const tabs = page.getByRole('navigation', { name: 'Настройки объекта', exact: true });
  await tabs.getByRole('link', { name: 'Услуги', exact: true }).click();
  await expect(page.getByTestId('services-table')).toBeVisible();
  await expect(sidebar.locator('[aria-current="page"]')).toHaveText('Объект');
  // часы заезда и выезда — своей вкладкой (ADR-115), правила отмены — у тарифов
  await tabs.getByRole('link', { name: 'Проживание', exact: true }).click();
  await expect(page.getByTestId('stay-settings')).toContainText('14:00');
  await page.reload();
  await expect(tabs.getByRole('link', { name: 'Проживание' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('старые страницы контента ведут в интеграции без чтения зеркала Channex', async ({
  page,
  request,
}) => {
  await request.post(`${API}/__test/control`, { data: { failPath: '/channels/channex/content' } });
  for (const route of ['photos', 'amenities']) {
    await page.goto(`/hotel-settings/${route}`);
    await expect(page).toHaveURL(/\/connections#channex-connection$/);
    // при переходе Next на миг держит уходящую страницу в скрытом узле стрима — ищем в видимом main
    await expect(page.getByRole('main').getByTestId('channel-content-location')).toBeVisible();
  }
  await page.goto('/hotel-settings/description');
  await expect(page).toHaveURL(/\/hotel-settings$/);
  await expect(page.getByRole('main').getByTestId('stored-property')).toBeVisible();
  await page.goto('/hotel-settings/check-in');
  await expect(page).toHaveURL(/\/hotel-settings\/stay$/);
  await expect(page.getByRole('main').getByTestId('stay-settings')).toBeVisible();
  const hits = await (await request.get(`${API}/__test/hits`)).json();
  expect(hits.byPath['/channels/channex/content'] ?? 0).toBe(0);
});

test('поиск услуг работает без повторной загрузки каталога', async ({
  page,
  request,
}) => {
  await page.goto('/hotel-settings/services');
  const table = page.getByTestId('services-table');
  await expect(table).toBeVisible();
  const count = await table.locator('tbody tr').count();
  expect(count).toBeGreaterThan(0);
  const before = await (await request.get(`${API}/__test/hits`)).json();
  await page.getByRole('searchbox', { name: 'Найти услугу' }).fill('Несуществующая услуга');
  await expect(page.getByTestId('services-no-results')).toBeVisible();
  await page.getByRole('button', { name: 'Сбросить отбор' }).click();
  await expect(table.locator('tbody tr')).toHaveCount(count);
  const after = await (await request.get(`${API}/__test/hits`)).json();
  // каталог «Настроек объекта» — весь, с архивными (SET3): `/hotel/services`
  expect(after.byPath['/hotel/services']).toBe(before.byPath['/hotel/services']);
});

test('ошибка каталога сохраняет навигацию и исправляется повтором', async ({ page, request }) => {
  await request.post(`${API}/__test/control`, { data: { failPath: '/hotel/services' } });
  await page.goto('/hotel-settings/services');
  await expect(page.getByTestId('services-error')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Настройки объекта' })).toBeVisible();
  await request.post(`${API}/__test/control`, { data: {} });
  await page
    .getByTestId('services-error')
    .getByRole('button', { name: 'Повторить загрузку' })
    .click();
  await expect(page.getByTestId('services-table')).toBeVisible();
});

for (const theme of ['light', 'dark'] as const) {
  test(`настройки адаптивны и доступны; установка кода открывается с клавиатуры: ${theme}`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      if (!devNoise.test(error.message)) errors.push(error.message);
    });
    for (const route of [
      '/hotel-settings',
      '/hotel-settings/services',
      '/hotel-settings/stay',
      '/connections',
      '/website/settings',
    ]) {
      await page.goto(route);
      const main = page.getByRole('main');
      await expect(main.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(main.locator('[data-testid$="loading"]')).toHaveCount(0);
      for (const width of [390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
      }
      if (route === '/hotel-settings' || route === '/website/settings') {
        const audit = await new AxeBuilder({ page })
          .include('main')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        expect(audit.violations).toEqual([]);
      }
      if (route === '/hotel-settings') {
        mkdirSync('reports/settings-simplification-2026-09-20', { recursive: true });
        await main.screenshot({
          path: `reports/settings-simplification-2026-09-20/hotel-${theme}-1440.png`,
        });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({
          path: `reports/settings-simplification-2026-09-20/hotel-${theme}-390.png`,
          fullPage: true,
        });
      }
    }
    // WEB2: установка счётчика — окно по кнопке; Escape закрывает его и возвращает фокус на кнопку
    const installer = page.getByTestId('site-install');
    await expect(page.getByTestId('site-card-snippet')).toHaveCount(0);
    await installer.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('site-card-snippet')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('site-card-snippet')).toHaveCount(0);
    await expect(installer).toBeFocused();
    // код виджета — в окне «Установка виджета» вкладки «Бронирование» (ADR-117, WEB3), тоже с клавиатуры
    await page.goto('/website/booking');
    const widget = page.getByTestId('booking-install');
    await widget.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('booking-demo-warning')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('booking-demo-warning')).toHaveCount(0);
    await expect(widget).toBeFocused();
    expect(errors).toEqual([]);
  });
}

test('на телефоне услуга и цена видны одновременно без прокрутки таблицы', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/hotel-settings/services');
  const table = page.getByTestId('services-table');
  await expect(table).toContainText('Стирка');
  // на телефоне колонки группы и статуса скрыты (SET3) — цена в своей колонке рядом с названием
  const price = table.getByRole('row', { name: /Стирка/ }).locator('td.num');
  const box = await price.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await expect(price).toContainText('1');
});
