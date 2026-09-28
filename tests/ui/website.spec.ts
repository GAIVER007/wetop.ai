import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { devNoise, expect, test, type APIRequestContext, type Page } from './fixtures';

/**
 * «Продажи → Сайт и онлайн-бронирование» (ADR-117, срез WEB1): сайт объекта — одно место вместо трёх («Аналитика
 * сайта», «Настройки сайта», панель в «Интеграциях»). Браузер → `next dev` → подставной API; учебный сайт фикстуры —
 * на домене-заглушке `example.invalid`, как боевой «Сайт Luxx Aparts» на `luxx-aparts.example`.
 */
const API = 'http://127.0.0.1:4311';
// запись в подставной API — только от прогона тестов
const TEST_CLIENT = { 'x-wetop-test-client': '1' };
const SHOTS = 'reports/website-web1-2026-09-27';
const TITLE = 'Сайт и онлайн-бронирование';

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

/** Настоящий домен у учебного сайта — так же, как «Сохранить домены» в «Настройках» */
const realDomain = (request: APIRequestContext) =>
  request.patch(`${API}/analytics/sites/ui-site`, {
    headers: TEST_CLIENT,
    data: { hosts: ['luxxaparts.kz'] },
  });

test('старые адреса ведут во вкладки модуля и сохраняют период', async ({ page }) => {
  await page.goto('/analytics?from=2026-09-01&to=2026-09-30');
  await expect(page).toHaveURL(/\/website\/analytics\?from=2026-09-01&to=2026-09-30$/);
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText(TITLE);
  await expect(main.getByLabel('Аналитика: с')).toHaveValue('2026-09-01');
  await page.goto('/analytics/setup');
  await expect(page).toHaveURL(/\/website\/settings$/);
  await expect(main.getByTestId('site-card')).toBeVisible();
});

test('одна точка входа в меню и четыре вкладки со своим адресом', async ({ page }) => {
  await page.goto('/website');
  const sidebar = page.locator('.workspace-sidebar');
  const hrefs = await sidebar
    .locator('.workspace-links a')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  expect(hrefs.filter((href) => href?.startsWith('/website'))).toEqual(['/website']);
  expect(hrefs.filter((href) => href?.startsWith('/analytics'))).toEqual([]);
  const tabs = page.getByRole('navigation', { name: TITLE, exact: true });
  await expect(tabs.getByRole('link')).toHaveText([
    'Обзор',
    'Бронирование',
    'Аналитика',
    'Настройки',
  ]);
  for (const [name, path] of [
    ['Бронирование', '/website/booking'],
    ['Аналитика', '/website/analytics'],
    ['Настройки', '/website/settings'],
    ['Обзор', '/website'],
  ] as const) {
    await tabs.getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(tabs.getByRole('link', { name, exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(sidebar.locator('[aria-current="page"]')).toHaveText(TITLE);
  }
});

test('домен-заглушка — «Сайт ещё не подключён», а не зелёный сайт', async ({ page }) => {
  await page.goto('/website');
  const main = page.getByRole('main');
  const empty = main.getByTestId('website-not-connected');
  await expect(empty).toContainText('Сайт ещё не подключён');
  await expect(empty.getByRole('link', { name: 'Подключить сайт' })).toHaveAttribute(
    'href',
    '/website/settings',
  );
  await expect(main.getByTestId('website-draft')).toContainText('Учебный сайт');
  await expect(main.getByTestId('website-overview')).toHaveCount(0);
  await expect(main).not.toContainText('Счётчик включён');
  await expect(main).not.toContainText('Работает');
  // «Бронирование» и «Аналитика» говорят о том же словами, а не молча показывают «включено»
  await page.goto('/website/booking');
  await expect(main.getByTestId('website-booking-state')).toHaveAttribute('data-state', 'blocked');
  await expect(main.getByTestId('booking-domain-missing')).toContainText(
    'Основной домен не настроен',
  );
  await page.goto('/website/analytics');
  await expect(main.getByTestId('an-domain-missing')).toContainText('Адрес сайта не указан');
});

test('обзор подключённого сайта: домен, счётчик, бронирование, брони за месяц', async ({
  page,
  request,
}) => {
  await realDomain(request);
  await page.goto('/website');
  const main = page.getByRole('main');
  const overview = main.getByTestId('website-overview');
  await expect(overview).toContainText('luxxaparts.kz');
  await expect(overview).toContainText('Ждём первое посещение');
  await expect(main.getByTestId('website-open')).toHaveAttribute('href', 'https://luxxaparts.kz');
  await expect(main.getByTestId('website-booking')).toContainText('Включено');
  await expect(main.getByTestId('website-booking')).toContainText('Тариф «Стандартный»');
  await expect(main.getByTestId('website-bookings')).toContainText('12');
  // событие сегодня — «Работает»; счётчик и виджет на паузе — «Приостановлен» и «Остановлено»
  await request.post(`${API}/__test/control`, {
    data: { siteLastEventAt: new Date(Date.now() - 2 * 60_000).toISOString() },
  });
  await page.reload();
  await expect(overview).toHaveAttribute('data-state', 'today');
  await expect(main.getByTestId('website-counter')).toContainText('Работает');
  await request.patch(`${API}/analytics/sites/ui-site`, {
    headers: TEST_CLIENT,
    data: { status: 'PAUSED' },
  });
  await page.reload();
  await expect(overview).toContainText('Приостановлен');
  await expect(main.getByTestId('website-booking')).toContainText('Остановлено');
});

test('«Интеграции» больше не показывают сайт', async ({ page }) => {
  await page.goto('/connections');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Интеграции');
  await expect(main).not.toContainText('Сайт и бронирования');
  await expect(main.locator('a[href^="/website"], a[href^="/analytics"]')).toHaveCount(0);
});

test('настройки: пауза и удаление — в «Опасной зоне», с подтверждением', async ({ page }) => {
  await page.goto('/website/settings');
  const danger = page.getByRole('main').getByTestId('site-danger');
  await expect(danger).toContainText('Опасная зона');
  await expect(danger.getByTestId('site-toggle')).toHaveText('Приостановить сайт');
  await expect(danger.getByTestId('site-delete')).toHaveText('Удалить подключение сайта');
  await danger.getByTestId('site-toggle').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('счётчик не записывает посещения');
  await dialog.getByRole('button', { name: 'Оставить как есть' }).click();
  await expect(page.getByTestId('site-toggle')).toHaveText('Приостановить сайт');
});

test('четыре вкладки: доступность в двух темах, телефон без прокрутки вбок', async ({
  page,
  request,
}) => {
  await realDomain(request);
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    for (const path of [
      '/website',
      '/website/booking',
      '/website/analytics',
      '/website/settings',
    ]) {
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText(TITLE);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          `${path} шире экрана ${width}`,
        ).toBe(true);
        const audit = await new AxeBuilder({ page })
          .include('main')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        expect(audit.violations, `${path} ${theme} ${width}`).toEqual([]);
      }
    }
  }
});

/** Снимки для визуального «да» владельца (стоп-гейт WEB1): обе темы, заглушка и подключённый сайт */
test('снимки WEB1', async ({ page, request }) => {
  mkdirSync(SHOTS, { recursive: true });
  // снимки для владельца — без ошибок страницы: сломанный экран на снимке хуже, чем упавший тест
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    if (!devNoise.test(error.message)) errors.push(`${page.url()}: ${error.message}`);
  });
  // значок «Issues» — оверлей `next dev` (шум `measure`, см. devNoise), в сборке его нет: на снимке он не нужен
  const shot = async (p: Page, name: string, full = true) => {
    await p.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: full, animations: 'disabled' });
  };
  for (const theme of ['light', 'dark'] as const) {
    await request.post(`${API}/__test/reset`);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/website');
    await expect(page.getByTestId('website-not-connected')).toBeVisible();
    await shot(page, `overview-placeholder-${theme}`);
    await realDomain(request);
    await request.post(`${API}/__test/control`, {
      data: { siteLastEventAt: new Date(Date.now() - 2 * 60_000).toISOString() },
    });
    await page.goto('/website');
    await expect(page.getByTestId('website-overview')).toHaveAttribute('data-state', 'today');
    await shot(page, `overview-${theme}`);
    await page.goto('/website/booking');
    await page.locator('summary').getByText('Установка виджета бронирования').click();
    await shot(page, `booking-${theme}`);
    await page.goto('/website/analytics');
    await expect(page.getByTestId('an-summary')).toBeVisible();
    await shot(page, `analytics-${theme}`);
    await page.goto('/website/settings');
    await expect(page.getByTestId('site-card')).toBeVisible();
    await shot(page, `settings-${theme}`);
    await page.goto('/connections');
    await shot(page, `integrations-${theme}`);
    const sales = page.locator('.workspace-sidebar');
    await page.goto('/website');
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    await sales.screenshot({ path: `${SHOTS}/menu-${theme}.png`, animations: 'disabled' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/website');
    await shot(page, `overview-${theme}-390`);
  }
  expect(errors).toEqual([]);
});
