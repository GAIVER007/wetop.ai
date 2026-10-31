import { FIXTURE_API, expect, test, devNoise, menuLinks, openSection, sideNav } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

/** UI3.1: одна кнопка меню, hover/focus раскрывает подразделы, переход закрывает панель.
 * Mobile использует отдельное окно навигации без нижней панели.
 */
// верхнее меню 17.10.2026 (ADR-TOPNAV-20261017): тот же состав в выдвижной панели
const routes = [
  // «Все бизнесы» владельцу (30.10.2026)
  '/owner',
  '/today',
  '/chessboard',
  '/team',
  // кабинет горничной и ресепшена S10 (22.10.2026): «График работы» и «Зарплата» есть и у гостиницы
  '/staff-schedule',
  '/payroll',
  '/guests',
  '/reservations',
  '/inventory',
  '/reports',
  '/management/analytics',
  '/bar/receipts',
  '/warehouse',
  '/bar',
  '/bar/consumables',
  '/bar/operations',
  '/finance',
  // 31.10.2026: «Касса» вместо «Отчётов»; объект, каналы, подключения и неисправности во «Всех настройках»
  '/cashbox',
  '/settings',
  '/journal',
  '/marketing',
  '/marketing/ads',
  '/marketing/content',
  '/marketing/voice',
  '/ai-agents',
  '/market',
  '/sales',
  // «Бюджет и аналитика» одним пунктом (20.10.2026): аналитика вкладкой раздела
  '/marketing/budget',
  '/help',
];

const SECTIONS = [
  'Главная',
  'Журнал',
  'Персонал',
  'Клиенты',
  'Услуги',
  'Статистика',
  'Склад',
  'Финансы',
  'Настройки',
  'Продвижение',
  'Помощь',
];

const fixture = FIXTURE_API;
const SHOTS = 'reports/ui3-1-2026-10-11/regression';
// кнопка ☰ и её панель живут до 1280 px; шире разделы строкой в шапке (решение владельца 18.10.2026, tab-nav.spec)
test.use({ viewport: { width: 1024, height: 900 } });

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('UI3.1: кнопка открывает разделы, наведение раскрывает подразделы, ссылка ведёт на страницу', async ({
  page,
}) => {
  await page.goto('/finance');
  const nav = sideNav(page);
  const trigger = nav.locator('.sidenav__current');
  const panel = nav.locator('.sidenav__panel');
  // 1. всегда виден только текущий раздел и его подразделы; строки вкладок в шапке больше нет
  await expect(page.locator('.workspace-header .sidenav')).toHaveCount(1);
  expect(await page.locator('.workspace').evaluate((el) => getComputedStyle(el).paddingLeft)).toBe(
    '0px',
  );
  await expect(trigger).toHaveText('Финансы');
  await expect(panel).toBeHidden();
  await expect(nav.locator('.sidenav__sub')).toHaveCount(0);
  // каждый адрес меню в разметке ровно один раз
  const links = await menuLinks(page);
  expect([...links].sort()).toEqual([...routes].sort());

  // 2. наведение: все разделы
  const items = await openSection(page, 'Настройки');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(nav.locator('.sidenav__section')).toHaveText(SECTIONS);
  // 3. наведение на раздел: его подразделы справа
  await expect(items).toHaveAttribute('aria-label', 'Настройки');
  await expect(items.locator('a')).toHaveText([
    // меню «Настройки» одно у всех направлений (31.10.2026)
    'Все настройки',
    'История действий',
    // «Все бизнесы» владельцу (30.10.2026)
    'Все бизнесы',
  ]);
  // 4. щелчок: переход на страницу, панель закрыта
  await items.getByRole('link', { name: 'Все настройки', exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(panel).toBeHidden();
  // 5. меню слева обновилось: новый раздел и его подразделы
  await expect(trigger).toHaveText('Настройки');
  // UI3.1: уход курсора сохраняет панель, внешний щелчок закрывает
  await openSection(page, 'Настройки');
  await page.mouse.move(1000, 800);
  await expect(panel).toBeVisible();
  await page.mouse.click(1000, 800);
  await expect(panel).toBeHidden();
  // раздел из одного пункта: справа его описание без второй ссылки (ширина панели не прыгает,
  // мастер-проход UI 11.10.2026), щелчок по самому разделу ведёт на страницу
  await openSection(page, 'Журнал');
  await expect(nav.getByRole('link', { name: 'Журнал', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Журнал', exact: true })).toHaveCount(1);
  await nav.locator('.sidenav__section', { hasText: /^Журнал$/ }).click();
  await expect(page).toHaveURL(/\/chessboard$/);
  await expect(trigger).toHaveText('Журнал');
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
  const section = (label: string) =>
    nav.locator('.sidenav__section', { hasText: new RegExp(`^${label}$`) });
  await expect(section('Финансы')).toBeFocused();
  // «Финансы» раскрыты (два пункта), третий шаг вниз это следующий раздел «Настройки»
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  await expect(section('Настройки')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(nav.locator('.sidenav__items:not([hidden])')).toHaveAttribute('aria-label', 'Настройки');
  const items = nav.locator('.sidenav__items:not([hidden])');
  await expect(items.getByRole('link', { name: 'Все настройки', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(items.getByRole('link', { name: 'История действий', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(section('Настройки')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toBeFocused();
  // Enter на подразделе ведёт на страницу: ↓ открывает панель на «Финансах», → в их подразделы
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  // 31.10.2026: вторым пунктом «Финансов» у гостиницы «Касса» (вкладка кассы её «Финансов»)
  await expect(items.getByRole('link', { name: 'Касса', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/cashbox$/, { timeout: 30_000 });
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('вложенные адреса показывают свой раздел', async ({ page }) => {
  test.setTimeout(90_000);
  const nav = sideNav(page);
  const trigger = nav.locator('.sidenav__current');
  const current = nav.locator('[aria-current="page"]');
  await page.goto('/hotel-settings/services');
  await expect(trigger).toHaveText('Настройки');
  await expect(current).toHaveText('Все настройки');
  // номерной фонд это «Каталог» раздела «Услуги»
  await page.goto('/rooms/categories');
  await expect(trigger).toHaveText('Услуги');
  await expect(nav.locator('[aria-current="page"]')).toHaveText('Каталог');
  // сайт: один пункт «Сайт и SEO» раздела «Маркетинг» (MKT2)
  await page.goto('/website/settings');
  await expect(trigger).toHaveText('Продвижение');
  // страницы продавца: «ИИ-продавец» в «Продвижении» (верхнее меню 17.10.2026)
  await page.goto('/ai-seller/dialogs');
  await expect(trigger).toHaveText('Продвижение');
  await expect(current).toHaveText('ИИ-продавец');
  await page.goto('/connections');
  await expect(trigger).toHaveText('Настройки');
  // 31.10.2026: экраны из «Всех настроек» подсвечивают «Все настройки»
  await expect(current).toHaveText('Все настройки');
  // адреса вне пунктов меню называют свой раздел, а не «Разделы» (мастер-проход UI 11.10.2026)
  await page.goto('/units/R01');
  await expect(trigger).toHaveText('Услуги');
  await page.goto('/tasks');
  await expect(trigger).toHaveText('Журнал');
  await page.goto('/profile');
  await expect(trigger).toHaveText('Профиль');
});

test('касание раздела на планшете раскрывает подразделы, а не уводит со страницы', async ({
  page,
}) => {
  await page.goto('/finance');
  const nav = sideNav(page);
  await nav.locator('.sidenav__current').click();
  const sales = nav.locator('.sidenav__section', { hasText: /^Продвижение$/ });
  await sales.dispatchEvent('pointerdown', { pointerType: 'touch' });
  await sales.click();
  await expect(page).toHaveURL(/\/finance$/);
  await expect(nav.locator('.sidenav__items:not([hidden])')).toHaveAttribute('aria-label', 'Продвижение');
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
    for (const width of [1024, 1279]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(nav).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      // Рабочая область больше не сдвинута пустой колонкой.
      const main = (await page.getByRole('main').boundingBox())!;
      expect(main.x).toBe(0);
      expect(main.width).toBeGreaterThanOrEqual(width - 20);
      await openSection(page, 'Продвижение');
      // панель целиком в окне
      const panel = (await nav.locator('.sidenav__panel').boundingBox())!;
      expect(panel.x + panel.width).toBeLessThanOrEqual(width);
      if (width === 1024) {
        const audit = await new AxeBuilder({ page })
          .include('.sidenav')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        expect(audit.violations).toEqual([]);
      }
      if (width === 1279) await page.screenshot({ path: `${SHOTS}/panel-${theme}-${width}.png` });
      await page.mouse.click(width - 10, 880);
      await expect(nav.locator('.sidenav__panel')).toBeHidden();
      if (width === 1279) await page.screenshot({ path: `${SHOTS}/sales-${theme}-${width}.png` });
    }
    // телефон: колонки нет, работает скрытое выдвижное меню
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(nav).toBeHidden();
    await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: 'Навигация', exact: true });
    for (const label of ['Главная', 'Журнал', 'Помощь'])
      await expect(drawer.getByRole('link', { name: label, exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
    const bottom = page.locator('.bottom-navigation');
    await expect(bottom).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: `${SHOTS}/phone-${theme}.png` });
    expect(errors).toEqual([]);
  });
}

test('кнопка текущего раздела находится в шапке и доступна после гидрации', async ({ page }) => {
  await page.goto('/today');
  const button = page
    .locator('.workspace-header')
    .getByRole('button', { name: 'Открыть меню', exact: true });
  await expect(button).toBeEnabled();
  // /today гостиницы — «Главная» (ADR-180)
  await expect(button).toHaveText('Главная');
  await button.click();
  await expect(sideNav(page).locator('.sidenav__panel')).toBeVisible();
});

test('menu panel offers an explicit close action and restores trigger focus', async ({ page }) => {
  await page.goto('/finance');
  const nav = sideNav(page);
  const trigger = nav.locator('.sidenav__current');
  await trigger.click();
  const close = nav.getByRole('button', { name: 'Закрыть меню', exact: true });
  await expect(close).toBeVisible();
  await close.click();
  await expect(nav.locator('.sidenav__panel')).toBeHidden();
  await expect(trigger).toBeFocused();
});
