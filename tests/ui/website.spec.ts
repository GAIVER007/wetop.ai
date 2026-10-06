import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API, devNoise, expect, test, type APIRequestContext, type Page } from './fixtures';

/**
 * «Продажи → Сайт и онлайн-бронирование» (ADR-117, срез WEB1): сайт объекта — одно место вместо трёх («Аналитика
 * сайта», «Настройки сайта», панель в «Интеграциях»). Браузер → `next dev` → подставной API; учебный сайт фикстуры —
 * на домене-заглушке `example.invalid`, как боевой «Сайт Luxx Aparts» на `luxx-aparts.example`.
 */
const API = FIXTURE_API;
// запись в подставной API — только от прогона тестов
const TEST_CLIENT = { 'x-wetop-test-client': '1' };
const SHOTS = 'reports/website-web2-2026-09-28';
const SHOTS_WEB3 = 'reports/website-web3-2026-09-28';
const SHOTS_WEB4 = 'reports/website-web4-2026-09-28';
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
  const sidebar = page.locator('.workspace-header .topmenu');
  const hrefs = await sidebar
    .locator('a')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  // MKT2: вход в сайт один, пункт «Маркетинг → Сайт и SEO» ведёт в хаб; у страниц /website/* пункта меню нет
  expect(hrefs.filter((href) => href?.startsWith('/website'))).toEqual([]);
  expect(hrefs.filter((href) => href?.startsWith('/marketing'))).toEqual(['/marketing']);
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
    await expect(sidebar.locator('[aria-current="page"]')).toHaveText('Сайт и SEO');
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
  // WEB4: брони с сайта за месяц — все брони с источником «Сайт» (Q-212), не только сессии со счётчиком
  await expect(main.getByTestId('website-bookings')).toContainText('14');
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
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Подключения');
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

test('WEB2 · домены списком: заглушка уходит, неверный адрес словами, последний не убирается', async ({
  page,
}) => {
  await page.goto('/website/settings');
  const main = page.getByRole('main');
  const rows = main.getByTestId('domain-row');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Пример, не сайт');
  await expect(main.getByTestId('domain-remove')).toHaveCount(0);
  await expect(main.getByTestId('domain-list')).toContainText('Последний адрес не убирается');
  // неверный адрес — словами, до запроса в API
  await main.getByTestId('domain-add').click();
  await main.getByTestId('domain-input').fill('luxx aparts');
  await main.getByTestId('domain-save').click();
  await expect(main.getByTestId('domain-list').getByRole('alert')).toContainText(
    'Не похоже на адрес сайта',
  );
  // адрес из браузера чистится, настоящий домен вытесняет заглушку
  await main.getByTestId('domain-input').fill('https://www.luxxaparts.kz/rooms');
  await main.getByTestId('domain-save').click();
  await expect(main.getByTestId('domain-result')).toContainText(
    'Домен luxxaparts.kz добавлен, заглушка example.invalid убрана',
  );
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toHaveAttribute('data-host', 'luxxaparts.kz');
  await expect(rows.first()).toContainText('Основной');
  await main.getByTestId('domain-add').click();
  await main.getByTestId('domain-input').fill('promo.kz');
  await main.getByTestId('domain-save').click();
  await expect(rows).toHaveCount(2);
  // убрать — через подтверждение, последствие названо до окна
  await main
    .locator('[data-testid="domain-row"][data-host="promo.kz"]')
    .getByTestId('domain-remove')
    .click();
  const confirm = page.getByRole('dialog', { name: 'Убрать promo.kz?' });
  await expect(confirm).toContainText('перестанет принимать посещения и брони');
  await confirm.getByRole('button', { name: 'Убрать домен' }).click();
  await expect(main.getByTestId('domain-result')).toContainText('Домен promo.kz убран');
  await expect(rows).toHaveCount(1);
  await expect(main.getByTestId('domain-remove')).toHaveCount(0);
});

test('WEB2 · счётчик: состояние словами и одно действие', async ({ page, request }) => {
  const main = page.getByRole('main');
  const counter = main.getByTestId('counter-state');
  await page.goto('/website/settings');
  await expect(counter).toHaveAttribute('data-state', 'blocked');
  await expect(main.getByTestId('counter-title')).toHaveText('Сначала адрес сайта');
  await expect(main.getByTestId('site-check')).toHaveCount(0);
  await realDomain(request);
  await page.reload();
  await expect(counter).toHaveAttribute('data-state', 'waiting');
  await expect(main.getByTestId('counter-title')).toHaveText('Событий ещё не было');
  await expect(main.getByTestId('site-check')).toHaveText('Проверить установку');
  await request.post(`${API}/__test/control`, {
    data: { siteLastEventAt: new Date(Date.now() - 2 * 60_000).toISOString() },
  });
  await page.reload();
  await expect(counter).toHaveAttribute('data-state', 'today');
  await expect(main.getByTestId('counter-title')).toHaveText('Работает');
  await expect(main.getByTestId('counter-text')).toContainText('Последнее событие в');
  await expect(main.getByTestId('site-check')).toHaveText('Проверить');
  await request.post(`${API}/__test/control`, {
    data: { siteLastEventAt: new Date(Date.now() - 3 * 86_400_000).toISOString() },
  });
  await page.reload();
  await expect(counter).toHaveAttribute('data-state', 'quiet');
  await expect(main.getByTestId('counter-title')).toHaveText('Сегодня событий нет');
  await request.patch(`${API}/analytics/sites/ui-site`, {
    headers: TEST_CLIENT,
    data: { status: 'PAUSED' },
  });
  await page.reload();
  await expect(counter).toHaveAttribute('data-state', 'paused');
  await expect(main.getByTestId('counter-text')).toContainText('«Опасной зоне»');
});

test('WEB2 · окно установки: код, GTM, конструкторы; доступно, закрывается Escape', async ({
  page,
}) => {
  await page.goto('/website/settings');
  const button = page.getByTestId('site-install');
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await button.click();
    const drawer = page.getByRole('dialog', { name: 'Установка счётчика WETOP' });
    await expect(drawer.getByTestId('site-card-snippet')).toContainText('public-ui-fixture');
    await expect(drawer).toContainText('Google Tag Manager');
    await expect(drawer).toContainText('Tilda');
    await expect(drawer.getByRole('button', { name: 'Скопировать код' })).toBeVisible();
    const audit = await new AxeBuilder({ page })
      .include('dialog[open]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(audit.violations, theme).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    await expect(button).toBeFocused();
  }
});

/** Снимки для визуального «да» владельца (стоп-гейт WEB2): обе темы, заглушка, ожидание и рабочий счётчик */
test('снимки WEB2', async ({ page, request }) => {
  mkdirSync(SHOTS, { recursive: true });
  // снимки для владельца — без ошибок страницы: сломанный экран на снимке хуже, чем упавший тест
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    if (!devNoise.test(error.message)) errors.push(`${page.url()}: ${error.message}`);
  });
  // значок «Issues» — оверлей `next dev` (шум `measure`, см. devNoise), в сборке его нет: на снимке он не нужен
  const hideDev = (p: Page) =>
    p.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  const shot = async (p: Page, name: string, full = true) => {
    await hideDev(p);
    await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: full, animations: 'disabled' });
  };
  for (const theme of ['light', 'dark'] as const) {
    await request.post(`${API}/__test/reset`);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/website/settings');
    await expect(page.getByTestId('site-card')).toBeVisible();
    await shot(page, `settings-placeholder-${theme}`);
    await page.getByTestId('domain-add').click();
    await page.getByTestId('domain-input').fill('https://www.luxxaparts.kz/');
    await shot(page, `domain-add-${theme}`);
    await page.getByTestId('domain-save').click();
    await expect(page.getByTestId('domain-result')).toBeVisible();
    await shot(page, `domain-added-${theme}`);
    await page.reload();
    await expect(page.getByTestId('counter-state')).toHaveAttribute('data-state', 'waiting');
    await shot(page, `settings-waiting-${theme}`);
    await request.post(`${API}/__test/control`, {
      data: { siteLastEventAt: new Date(Date.now() - 2 * 60_000).toISOString() },
    });
    await page.reload();
    await expect(page.getByTestId('counter-state')).toHaveAttribute('data-state', 'today');
    await shot(page, `settings-working-${theme}`);
    await page.getByTestId('site-install').click();
    await expect(page.getByRole('dialog', { name: 'Установка счётчика WETOP' })).toBeVisible();
    await shot(page, `install-drawer-${theme}`, false);
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/website/settings');
    await shot(page, `settings-working-${theme}-390`);
  }
  expect(errors).toEqual([]);
});

/** Настоящий адрес демо, как у API на сервере (`${PUBLIC_API_URL}/w/demo?k=…`); у фикстуры по умолчанию — относительный */
const DEMO_URL = `${FIXTURE_API}/w/demo?k=public-ui-fixture`;

test('WEB3 · бронирование: состояние, демо только у работающего, что увидит гость', async ({
  page,
  request,
}) => {
  await realDomain(request);
  await request.post(`${API}/__test/control`, { data: { bookingDemoUrl: DEMO_URL } });
  await page.goto('/website/booking');
  const main = page.getByRole('main');
  const state = main.getByTestId('website-booking-state');
  await expect(state).toHaveAttribute('data-state', 'on');
  await expect(state).toContainText('Бронь сразу в PMS, оплата при заселении');
  await expect(main.getByTestId('site-card-booking-demo')).toHaveAttribute('href', DEMO_URL);
  await expect(main.getByTestId('site-card-booking-demo')).toHaveAttribute('target', '_blank');
  await expect(main.getByTestId('booking-guest-plan')).toContainText('«Стандартный»');
  await expect(main.getByTestId('booking-guest-plan')).toContainText('KZT');
  await expect(main.getByTestId('booking-guest-limits')).toContainText('предоплату');
  // ADR-144: языки формы и письмо-подтверждение гостю
  await expect(main.getByTestId('booking-guest-limits')).toContainText('казахский, английский, китайский');
  await expect(main.getByTestId('booking-guest-letter')).toContainText('письмо с подтверждением');
  // выключили — строка говорит правду: форма на сайте останется, но цен не покажет; демо и кода нет
  await main.getByTestId('booking-enabled').uncheck();
  await main.getByTestId('booking-save').click();
  await expect(main.getByTestId('booking-result')).toHaveText(
    'Бронирование с сайта выключено: форма на сайте останется, но цены и брони не покажет',
  );
  await page.reload();
  await expect(state).toHaveAttribute('data-state', 'off');
  await expect(state).toContainText('Форма на сайте цены не покажет');
  await expect(main.getByTestId('booking-actions')).toHaveCount(0);
  await expect(main.getByTestId('site-card-booking-demo')).toHaveCount(0);
});

test('WEB3 · без адреса сайта демо не предлагается, код виджета — есть', async ({
  page,
  request,
}) => {
  await request.post(`${API}/__test/control`, { data: { bookingDemoUrl: DEMO_URL } });
  await page.goto('/website/booking');
  const main = page.getByRole('main');
  await expect(main.getByTestId('website-booking-state')).toHaveAttribute('data-state', 'blocked');
  await expect(main.getByTestId('website-booking-state')).toContainText('Нет адреса сайта');
  await expect(main.getByTestId('booking-domain-missing')).toBeVisible();
  await expect(main.getByTestId('site-card-booking-demo')).toHaveCount(0);
  await expect(main.getByTestId('booking-install')).toBeVisible();
});

test('WEB3 · тариф сайта: смена видна в состоянии и в «Что увидит гость»', async ({
  page,
  request,
}) => {
  await request.post(`${API}/__test/control`, { data: { softPlan: true } });
  await realDomain(request);
  await page.goto('/website/booking');
  const main = page.getByRole('main');
  await main.getByTestId('booking-rate-plan').selectOption('FLEX');
  await main.getByTestId('booking-save').click();
  await expect(main.getByTestId('booking-result')).toContainText('тариф «Гибкий без штрафа»');
  await expect(main.getByTestId('booking-result')).toContainText('«Установке виджета»');
  await page.reload();
  await expect(main.getByTestId('website-booking-state')).toContainText('Гибкий без штрафа');
  await expect(main.getByTestId('booking-guest-plan')).toContainText('«Гибкий без штрафа»');
  await expect(main.getByTestId('booking-rate-plan')).toHaveValue('FLEX');
});

test('WEB3 · окно установки виджета: код, место и цвет, проверка; доступно, закрывается Escape', async ({
  page,
}) => {
  await page.goto('/website/booking');
  const button = page.getByTestId('booking-install');
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await button.click();
    const drawer = page.getByRole('dialog', { name: 'Установка виджета бронирования' });
    await expect(drawer.getByTestId('site-card-booking-snippet')).toContainText('data-booking');
    await expect(drawer).toContainText('data-target');
    await expect(drawer).toContainText('--pmsw-accent');
    await expect(drawer.getByTestId('booking-demo-warning')).toContainText('настоящая');
    await expect(drawer.getByRole('button', { name: 'Скопировать код' })).toBeVisible();
    const audit = await new AxeBuilder({ page })
      .include('dialog[open]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(audit.violations, theme).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    await expect(button).toBeFocused();
  }
});

/** Снимки для визуального «да» владельца (стоп-гейт WEB3): работает, окно установки, выключено, без адреса, телефон */
test('снимки WEB3', async ({ page, request }) => {
  mkdirSync(SHOTS_WEB3, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    if (!devNoise.test(error.message)) errors.push(`${page.url()}: ${error.message}`);
  });
  const shot = async (p: Page, name: string, full = true) => {
    await p.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    await p.screenshot({
      path: `${SHOTS_WEB3}/${name}.png`,
      fullPage: full,
      animations: 'disabled',
    });
  };
  for (const theme of ['light', 'dark'] as const) {
    await request.post(`${API}/__test/reset`);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/website/booking');
    await expect(page.getByTestId('website-booking-state')).toHaveAttribute(
      'data-state',
      'blocked',
    );
    await shot(page, `booking-placeholder-${theme}`);
    await realDomain(request);
    await request.post(`${API}/__test/control`, { data: { bookingDemoUrl: DEMO_URL } });
    await page.reload();
    await expect(page.getByTestId('website-booking-state')).toHaveAttribute('data-state', 'on');
    await shot(page, `booking-on-${theme}`);
    await page.getByTestId('booking-install').click();
    await expect(
      page.getByRole('dialog', { name: 'Установка виджета бронирования' }),
    ).toBeVisible();
    await shot(page, `booking-install-${theme}`, false);
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await shot(page, `booking-on-${theme}-390`);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByTestId('booking-enabled').uncheck();
    await page.getByTestId('booking-save').click();
    await expect(page.getByTestId('booking-result')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('website-booking-state')).toHaveAttribute('data-state', 'off');
    await shot(page, `booking-off-${theme}`);
  }
  expect(errors).toEqual([]);
});

test('WEB4 · брони с сайта: число, отменённые, начислено и ссылка в «Брони» с тем же отбором', async ({
  page,
}) => {
  await page.goto('/website/analytics');
  const main = page.getByRole('main');
  const block = main.getByTestId('an-site-reservations');
  await expect(block.getByTestId('an-site-reservations-count')).toHaveText('14');
  await expect(block).toContainText('отменено 1');
  await expect(block).toContainText('не заехали 1');
  await expect(block.getByTestId('an-site-reservations-charged')).toHaveText('1 420 000 ₸');
  // ссылка — тот же период, что у отчёта, по дате создания и источнику «Сайт»: числа сверяются в «Бронях»
  const from = await main.getByTestId('an-period').locator('time').first().getAttribute('datetime');
  const to = await main.getByTestId('an-period').locator('time').last().getAttribute('datetime');
  await expect(block.getByRole('link', { name: 'Открыть в «Бронях»' })).toHaveAttribute(
    'href',
    `/reservations?from=${from}&to=${to}&date=created&source=WEBSITE`,
  );
  // плитка счётчика больше не называется так же, как блок броней
  const tile = main.getByTestId('an-bookings').locator('xpath=..');
  await expect(tile).toContainText('Сессий с бронью');
  await expect(tile).not.toContainText('Брони с сайта');
});

test('WEB4 · воронка: шаги по сессиям, проценты от предыдущего шага, конверсия', async ({
  page,
}) => {
  await page.goto('/website/analytics');
  const funnel = page.getByRole('main').getByTestId('an-funnel');
  const steps = funnel.getByTestId('an-funnel-step');
  await expect(steps).toHaveCount(4);
  await expect(steps.nth(0)).toContainText('Посещения');
  await expect(steps.nth(0)).toContainText('125');
  await expect(steps.nth(1)).toContainText('Поиск дат');
  await expect(steps.nth(1)).toContainText('40');
  await expect(steps.nth(1)).toContainText('32 % от посещений');
  await expect(steps.nth(2)).toContainText('Начали бронь');
  await expect(steps.nth(2)).toContainText('18');
  await expect(steps.nth(2)).toContainText('45 % от поиска');
  await expect(steps.nth(3)).toContainText('Бронь');
  await expect(steps.nth(3)).toContainText('12');
  await expect(steps.nth(3)).toContainText('67 % от начатых');
  await expect(funnel.getByTestId('an-funnel-conversion')).toHaveText('9,6 %');
});

/** Снимки для визуального «да» владельца (стоп-гейт WEB4): вкладка «Аналитика» в двух темах и на телефоне */
test('снимки WEB4', async ({ page }) => {
  mkdirSync(SHOTS_WEB4, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    if (!devNoise.test(error.message)) errors.push(`${page.url()}: ${error.message}`);
  });
  const shot = async (p: Page, name: string) => {
    await p.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    await p.screenshot({
      path: `${SHOTS_WEB4}/${name}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  };
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/website/analytics');
    await expect(page.getByTestId('an-funnel')).toBeVisible();
    await shot(page, `analytics-${theme}`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByTestId('an-funnel')).toBeVisible();
    await shot(page, `analytics-${theme}-390`);
  }
  expect(errors).toEqual([]);
});
