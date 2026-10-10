import {
  FIXTURE_API,
  expect,
  test,
  devNoise,
  menuLinks,
  openSection,
  sideNav,
} from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

/**
 * Левая контекстная навигация (ТЗ «Новая навигация админки», ADR-161): видна кнопка текущего раздела и его
 * подразделы; наведение открывает панель всех разделов, наведение на раздел показывает справа его подразделы,
 * щелчок ведёт на страницу и обновляет меню. На телефоне и планшете по-прежнему окно «Навигация» и нижняя панель.
 */
const routes = [
  '/ai-agents',
  '/chessboard',
  '/guests',
  '/inventory',
  '/sales',
  '/market',
  '/channels',
  '/marketing',
  '/reports',
  '/finance',
  '/bar',
  '/management/analytics',
  '/hotel-settings',
  '/connections',
  '/team',
  '/journal',
  '/incidents',
];

const SECTIONS = [
  'Финансы',
  'Календарь',
  'Гости и бронирования',
  'Продажи',
  'Маркетинг',
  'Отчёты',
  'Номерной фонд',
  'Настройки',
];

const fixture = FIXTURE_API;
const SHOTS = 'reports/side-nav-2026-10-10';

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('ТЗ §4: текущий раздел виден, наведение открывает все разделы, справа подразделы, щелчок ведёт и обновляет меню', async ({
  page,
}) => {
  await page.goto('/finance');
  const nav = sideNav(page);
  const trigger = nav.locator('.sidenav__current');
  const panel = nav.locator('.sidenav__panel');
  // 1. всегда виден только текущий раздел и его подразделы; строки вкладок в шапке больше нет
  await expect(page.locator('.workspace-header nav')).toHaveCount(0);
  await expect(trigger).toHaveText('Финансы');
  await expect(panel).toBeHidden();
  await expect(nav.locator('.sidenav__sub a')).toHaveText(['Оплаты и касса', 'Бар']);
  await expect(nav.locator('.sidenav__sub [aria-current="page"]')).toHaveText('Оплаты и касса');
  // каждый адрес меню в разметке ровно один раз
  const links = await menuLinks(page);
  expect([...links].sort()).toEqual([...routes].sort());

  // 2. наведение: все разделы
  const items = await openSection(page, 'Продажи');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(nav.locator('.sidenav__section')).toHaveText(SECTIONS);
  // 3. наведение на раздел: его подразделы справа
  await expect(items.locator('.sidenav__title')).toHaveText('Продажи');
  await expect(items.locator('a')).toHaveText([
    'Обзор продаж',
    'Загрузка конкурентов',
    'Каналы продаж',
    'ИИ-продавцы',
  ]);
  // 4. щелчок: переход на страницу, панель закрыта
  await items.getByRole('link', { name: 'Загрузка конкурентов', exact: true }).click();
  await expect(page).toHaveURL(/\/market$/);
  await expect(panel).toBeHidden();
  // 5. меню слева обновилось: новый раздел и его подразделы
  await expect(trigger).toHaveText('Продажи');
  await expect(nav.locator('.sidenav__sub [aria-current="page"]')).toHaveText(
    'Загрузка конкурентов',
  );
  // ТЗ §6: уход курсора закрывает панель
  await openSection(page, 'Настройки');
  await page.mouse.move(1200, 800);
  await expect(panel).toBeHidden();
  // раздел из одного пункта: щелчок по самому разделу ведёт на страницу
  await openSection(page, 'Календарь');
  await nav.locator('.sidenav__section', { hasText: /^Календарь$/ }).click();
  await expect(page).toHaveURL(/\/chessboard$/);
  await expect(trigger).toHaveText('Календарь');
  await expect(nav.locator('.sidenav__sub')).toHaveCount(0);
});

test('ТЗ §9: клавиатура, ↓ открывает, ↑↓ по разделам, → в подразделы, ← назад, Escape закрывает', async ({
  page,
}) => {
  await page.goto('/finance');
  const nav = sideNav(page);
  const trigger = nav.locator('.sidenav__current');
  await expect(async () => {
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true', { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  // фокус встаёт на текущий раздел
  const section = (label: string) => nav.locator('.sidenav__section', { hasText: new RegExp(`^${label}$`) });
  await expect(section('Финансы')).toBeFocused();
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  await expect(section('Продажи')).toBeFocused();
  await expect(nav.locator('.sidenav__items > :not([hidden]) .sidenav__title')).toHaveText('Продажи');
  await page.keyboard.press('ArrowRight');
  const items = nav.locator('.sidenav__items > :not([hidden])');
  await expect(items.getByRole('link', { name: 'Обзор продаж', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(items.getByRole('link', { name: 'Загрузка конкурентов', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(section('Продажи')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toBeFocused();
  // Enter на подразделе ведёт на страницу: ↓ открывает панель на «Финансах», → в их подразделы
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await expect(items.getByRole('link', { name: 'Бар', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/bar$/);
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('вложенные адреса показывают свой раздел', async ({ page }) => {
  const nav = sideNav(page);
  const trigger = nav.locator('.sidenav__current');
  const current = nav.locator('.sidenav__sub [aria-current="page"]');
  await page.goto('/hotel-settings/services');
  await expect(trigger).toHaveText('Настройки');
  await expect(current).toHaveText('Объект');
  // «Номерной фонд»: раздел из одного пункта, подразделов под кнопкой нет (ADR-108)
  await page.goto('/rooms/categories');
  await expect(trigger).toHaveText('Номерной фонд');
  await expect(nav.locator('.sidenav__items [aria-current="page"]')).toHaveText('Номерной фонд');
  // сайт: один пункт «Сайт и SEO» раздела «Маркетинг» (MKT2)
  await page.goto('/website/settings');
  await expect(trigger).toHaveText('Маркетинг');
  // страницы продавца: «ИИ-продавцы» в «Продажах» (S0)
  await page.goto('/ai-seller/dialogs');
  await expect(trigger).toHaveText('Продажи');
  await expect(current).toHaveText('ИИ-продавцы');
  await page.goto('/connections');
  await expect(trigger).toHaveText('Настройки');
  await expect(current).toHaveText('Подключения');
});

for (const theme of ['light', 'dark'] as const) {
  test(`меню без прокрутки вбок и доступное: ${theme}`, async ({ page }) => {
    test.setTimeout(120_000);
    mkdirSync(SHOTS, { recursive: true });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      if (!devNoise.test(error.message)) errors.push(error.message);
    });
    await page.goto('/sales');
    const nav = sideNav(page);
    for (const width of [1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(nav).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      // содержимое начинается правее колонки меню
      const aside = (await nav.boundingBox())!;
      const main = (await page.getByRole('main').boundingBox())!;
      expect(main.x).toBeGreaterThanOrEqual(aside.x + aside.width - 1);
      await openSection(page, 'Продажи');
      // панель целиком в окне
      const panel = (await nav.locator('.sidenav__panel').boundingBox())!;
      expect(panel.x + panel.width).toBeLessThanOrEqual(width);
      if (width === 1024 || width === 1440) {
        const audit = await new AxeBuilder({ page })
          .include('.sidenav')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        expect(audit.violations).toEqual([]);
      }
      if (width === 1440)
        await page.screenshot({ path: `${SHOTS}/panel-${theme}-${width}.png` });
      await page.mouse.move(width - 10, 880);
      await expect(nav.locator('.sidenav__panel')).toBeHidden();
      if (width === 1440) await page.screenshot({ path: `${SHOTS}/sales-${theme}-${width}.png` });
    }
    // телефон: колонки нет, работают выдвижное меню и нижняя панель
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(nav).toBeHidden();
    await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: 'Навигация', exact: true });
    for (const label of ['Календарь', 'Гости и бронирования', 'Номерной фонд'])
      await expect(drawer.getByRole('link', { name: label, exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
    const bottom = page.locator('.bottom-navigation');
    await expect(bottom.locator('a')).toHaveText(['Финансы', 'Календарь', 'Брони', 'Продажи']);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBe(true);
    await page.screenshot({ path: `${SHOTS}/phone-${theme}.png` });
    expect(errors).toEqual([]);
  });
}
