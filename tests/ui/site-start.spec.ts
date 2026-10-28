import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { FIXTURE_API, expect, test, type Page } from './fixtures';

/**
 * SITE-1 (`plans/site-seo-flow-2026-10-15.md` §1 шаги 1–3): первый экран «Сайт и SEO» как у Lovable. Филиал со
 * статусом сайта, «Что WETOP знает о филиале», три готовых шаблона сайта своего сегмента (гостиница, салон, ресторан)
 * с живым превью, чат с подсказками и диктовкой. «Создать сайт» по шаблону без ИИ сразу открывает редактор с готовым
 * сайтом из данных филиала, у всех трёх направлений. Стенд отвечает правилами API, данные вымышленные (ADR-010).
 */
const SHOTS = 'reports/site-1';
const main = (page: Page) => page.getByRole('main').filter({ visible: true });
const site = (request: { post: (url: string, o: { data: unknown }) => Promise<unknown> }, data: Record<string, unknown>) =>
  request.post(`${FIXTURE_API}/__test/marketing-site`, { data });
const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).exclude('[data-testid="site-design-frame"]').analyze();
const wide = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('main *')]
      .filter((el) => el.getBoundingClientRect().right > innerWidth + 1 && !el.closest('.site-design__shot'))
      .slice(0, 5)
      .map((el) => `${el.tagName}.${el.className}`),
  );
/** Рамки превью рисуются, когда побывали в окне: перед снимком всей страницы прокручиваем к ним */
async function paintPreviews(page: Page) {
  const frames = main(page).getByTestId('site-design-frame');
  for (let i = 0; i < (await frames.count()); i++) await frames.nth(i).scrollIntoViewIfNeeded();
  await expect(frames.first()).toHaveAttribute('srcdoc', /<body/);
  await page.waitForTimeout(300);
  await page.evaluate('window.scrollTo(0, 0)');
}
const editor = (page: Page) => main(page).getByTestId('site-setup');
const designIds = async (page: Page) => main(page).getByTestId('site-design-card').evaluateAll((els) => els.map((e) => e.getAttribute('data-design')));

async function signIn(page: Page) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
}

test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

test('гостиница: филиал → факты → чип → три шаблона гостиницы → создать по шаблону → редактор', async ({ page, request }) => {
  await site(request, { noSite: true });
  await page.goto('/marketing/site/editor');
  const win = main(page).getByTestId('create-site');
  await expect(win.getByRole('heading', { name: 'Сайт для Luxx Aparts' })).toBeVisible();

  // шаг 1: филиал со статусом сайта, текущий отмечен
  const current = win.getByTestId('site-location').filter({ hasText: 'выбран' });
  await expect(current).toHaveAttribute('aria-current', 'true');
  await expect(current).toContainText('Гостиница');
  await expect(current).toContainText('Нет сайта');

  // карточка фактов: адрес, телефон, каталог с ценой в тенге, «ещё K», отзывы, пробел со ссылкой «Дополнить»
  const facts = win.getByTestId('create-site-facts');
  await expect(facts.getByRole('heading', { name: 'Что WETOP знает о филиале' })).toBeVisible();
  await expect(facts).toContainText('ул. Вымышленная, 1');
  await expect(facts).toContainText('Телефон+7701');
  await expect(facts.getByTestId('site-facts-catalog')).toContainText('Стандарт');
  await expect(facts.getByTestId('site-facts-catalog')).toContainText('от 18 500 ₸');
  await expect(facts.getByTestId('site-facts-more')).toHaveText('и ещё 2 позиции');
  await expect(facts).toContainText('Заезд с 14:00, выезд до 12:00');
  await expect(facts).toContainText('4,7 из 5, 128 отзывов');
  await expect(facts.getByRole('link', { name: /Дополнить: Нет WhatsApp/ })).toHaveAttribute('href', '/hotel-settings');

  // шаг 2: подсказка-чип дописывает запрос и нажимается обратно
  const chip = win.getByTestId('site-chip').filter({ hasText: 'Акцент на семейном отдыхе' });
  await expect(win.getByTestId('site-chip')).toHaveText(['Сайт с онлайн-бронированием', 'Акцент на семейном отдыхе', 'Покажи трансфер']);
  await win.getByLabel('Опишите, каким должен быть сайт').fill('Спокойный сайт у вокзала');
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect(win.getByLabel('Опишите, каким должен быть сайт')).toHaveValue('Спокойный сайт у вокзала. Акцент на семейном отдыхе');

  // шаг 3: три шаблона гостиницы с живым превью сайта из данных филиала; стрелками выбирается следующий
  const cards = win.getByTestId('site-design-card');
  await expect(cards).toHaveCount(3);
  expect(await designIds(page)).toEqual(['hotel-classic', 'hotel-boutique', 'hotel-hostel']);
  await expect(win.getByTestId('site-design-frame')).toHaveCount(3);
  await expect(win.getByTestId('site-design-frame').first()).toHaveAttribute('srcdoc', /Luxx Aparts[\s\S]*Стандарт/);
  await expect(win.getByRole('radio', { name: /Классический отель/ })).toHaveAttribute('aria-checked', 'true');
  await win.getByRole('radio', { name: /Классический отель/ }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(win.getByRole('radio', { name: /Бутик-отель/ })).toHaveAttribute('aria-checked', 'true');
  await expect(win.getByRole('radio', { name: /Бутик-отель/ })).toBeFocused();
  // «Посмотреть»: сайт по шаблону целиком в окне, на компьютере и телефоне; выбрать прямо из окна
  await win.getByTestId('site-design-card').filter({ hasText: 'Хостел' }).getByTestId('site-design-view').click();
  const viewer = page.getByTestId('tpl-viewer');
  await expect(viewer).toBeVisible();
  await expect(viewer.getByTestId('tpl-viewer-frame')).toHaveAttribute('srcdoc', /Luxx Aparts/);
  await viewer.getByRole('button', { name: 'Телефон' }).click();
  await page.screenshot({ path: `${SHOTS}/hotel-template-view-1440.png` });
  await viewer.getByTestId('tpl-viewer-choose').click();
  await expect(viewer).toHaveCount(0);
  await expect(win.getByTestId('site-design-chosen')).toHaveText('Выбран шаблон «Хостел и апарт».');
  await win.getByTestId('site-design-card').filter({ hasText: 'Бутик-отель' }).getByTestId('site-design-choose').click();
  await expect(win.getByTestId('site-design-chosen')).toHaveText('Выбран шаблон «Бутик-отель».');
  // «Собрать с ИИ» доступна только с текстом; текст уже есть
  await expect(win.getByTestId('create-site-ai')).toBeEnabled();
  await expect.poll(async () => (await axe(page)).violations).toEqual([]);
  await paintPreviews(page);
  await page.screenshot({ path: `${SHOTS}/hotel-flow-1440.png`, fullPage: true });
  await win.getByTestId('site-designs').screenshot({ path: `${SHOTS}/hotel-designs-1440.png` });

  // создать по шаблону: без ИИ, сразу редактор с готовым сайтом в теме шаблона, сайт правится
  await win.getByTestId('create-site-start').click();
  await expect(editor(page)).toBeVisible({ timeout: 15_000 });
  // сайт открылся на простом экране с выбранным шаблоном
  await expect(main(page).getByTestId('setup-template').getByTestId('site-design-card').filter({ hasText: 'Бутик-отель' }).getByRole('radio')).toHaveAttribute('aria-checked', 'true');
});

test('диктовка: фраза дописывается в запрос, язык выбирается; без поддержки браузера кнопки нет', async ({ page, request }) => {
  await site(request, { noSite: true });
  await page.goto('/marketing/site/editor');
  // Chromium Playwright без сервиса распознавания: кнопки диктовки нет
  const win = main(page).getByTestId('create-site');
  await expect(win.getByTestId('site-chip').first()).toBeVisible();
  const hasNative = await page.evaluate('Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)');
  if (!hasNative) await expect(win.getByTestId('site-mic')).toHaveCount(0);

  await page.addInitScript(`window.SpeechRecognition = class {
    start() { window.__dictationLang = this.lang; this.onresult({resultIndex:0,results:[{isFinal:true,0:{transcript:'Покажи номера с балконом'}}]}); }
    stop() { window.__dictationStopped = true; this.onend?.(); }
    abort() {}
  };`);
  await page.reload();
  await win.getByLabel('Опишите, каким должен быть сайт').fill('Сайт у вокзала');
  await win.getByLabel('Язык диктовки').selectOption('kk-KZ');
  await win.getByTestId('site-mic').click();
  await expect(win.getByLabel('Опишите, каким должен быть сайт')).toHaveValue('Сайт у вокзала Покажи номера с балконом');
  expect(await page.evaluate('window.__dictationLang')).toBe('kk-KZ');
  await expect(win.getByTestId('site-mic')).toHaveAttribute('aria-pressed', 'true');
  await win.getByTestId('site-mic').click();
  expect(await page.evaluate('window.__dictationStopped')).toBe(true);
});

test('факты без эндпоинта API: карточка собрана из брифа гостиницы, экран работает', async ({ page, request }) => {
  await site(request, { noSite: true, factsApi: false });
  await page.goto('/marketing/site/editor');
  const facts = main(page).getByTestId('create-site-facts');
  await expect(facts.getByTestId('site-facts-catalog')).toContainText('Стандарт');
  await expect(facts.getByTestId('site-facts-catalog')).toContainText('Койка в общем номере');
  await expect(facts).toContainText('ул. Вымышленная, 1');
  // без эндпоинта статус сайта известен только у выбранного филиала; стенд без входа филиал не выбирал
  await expect(main(page).getByTestId('site-location')).toContainText(['Тестовый центральный филиал']);
  await expect(facts.getByRole('link', { name: /Дополнить: Нет цен/ })).toHaveAttribute('href', '/rates');
});

test('салон: выбор филиала переключает стойку, свои три шаблона, создание по шаблону открывает редактор', async ({ page, request }) => {
  test.setTimeout(120_000);
  const salon = '5a1c0000-0000-4000-8000-00000000a001';
  await signIn(page);
  await request.post(`${FIXTURE_API}/branches`, {
    headers: { 'x-wetop-test-client': '1' },
    data: { id: salon, name: 'Студия Айна', address: 'пр. Абая, 1', currency: 'KZT', timezone: 'Asia/Almaty', vertical: 'BEAUTY' },
  });
  // данные салона: две услуги филиала с ценой и мастер филиала (как их заводит стойка)
  const branches = (await (await request.get(`${FIXTURE_API}/branches`, { headers: { 'x-wetop-test-client': '1' } })).json()) as {
    items: Array<{ id: string; businessId?: string; locationId: string }>;
  };
  const own = branches.items.find((b) => b.id === salon)!;
  const scoped = { 'x-wetop-test-client': '1', 'x-wetop-scope': `business=${own.businessId ?? salon};location=${own.locationId}` };
  for (const [name, priceMinor, durationMinutes] of [['Маникюр с покрытием', '900000', 75], ['Женская стрижка', '1200000', 60]] as const) {
    const svc = (await (await request.post(`${FIXTURE_API}/beauty/services`, { headers: scoped, data: { name, durationMinutes, priceMinor, currency: 'KZT' } })).json()) as { id: string };
    await request.put(`${FIXTURE_API}/beauty/services/${svc.id}/location`, { headers: scoped, data: { enabled: true } });
  }
  await request.post(`${FIXTURE_API}/beauty/employees`, { headers: scoped, data: { name: 'Айгерим Касымова' } });
  await site(request, { noSite: true });
  await page.goto('/marketing/site/editor');
  const win = main(page).getByTestId('create-site');
  const target = win.getByTestId('site-location').filter({ hasText: 'Студия Айна' });
  await expect(target).toContainText('Салон');
  await target.click();
  await expect(win.getByRole('heading', { name: 'Сайт для Студия Айна' })).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/marketing\/site\/editor$/);
  await expect(win.getByTestId('site-location').filter({ hasText: 'выбран' })).toContainText('Студия Айна');
  await expect(win.getByTestId('site-chip')).toHaveText(['Сайт для записи на услуги', 'Акцент на мастерах', 'Акция на первое посещение']);
  await expect(win.getByTestId('create-site-facts').getByTestId('site-facts-staff')).toContainText('Айгерим Касымова');
  await expect(win.getByTestId('site-facts-catalog')).toContainText('Маникюр с покрытием');
  await expect(win.getByTestId('site-design-frame').first()).toHaveAttribute('srcdoc', /Студия Айна/);
  await expect(main(page).getByTestId('ed-license-off')).toHaveCount(0);
  await expect.poll(async () => (await axe(page)).violations).toEqual([]);
  await paintPreviews(page);
  await page.screenshot({ path: `${SHOTS}/salon-light-1440.png`, fullPage: true });
  // три своих шаблона салона; выбранный создаётся сразу, без ИИ, и открывается редактор с услугами и мастерами
  expect(await designIds(page)).toEqual(['beauty-studio', 'beauty-boutique', 'beauty-express']);
  await win.getByTestId('site-design-card').filter({ hasText: 'Яркий поп' }).getByTestId('site-design-choose').click();
  await expect(win.getByTestId('site-design-chosen')).toHaveText('Выбран шаблон «Яркий поп».');
  await win.getByTestId('create-site-start').click();
  await expect(editor(page)).toBeVisible({ timeout: 15_000 });
  await expect(main(page).getByTestId('create-site-error')).toHaveCount(0);
  await expect(main(page).getByTestId('setup-template').getByTestId('site-design-card').filter({ hasText: 'Яркий поп' }).getByRole('radio')).toHaveAttribute('aria-checked', 'true');
  await expect(page.frameLocator('[data-testid="ed-frame"]').locator('main')).toContainText('Маникюр с покрытием');
  await page.screenshot({ path: `${SHOTS}/salon-editor-1440.png`, fullPage: true });
  // аудит «Сайт и SEO» 28.10.2026: салон публикует сайт той же кнопкой, что гостиница (API с ADR-185)
  const publish = main(page).getByTestId('setup-publish-btn');
  await expect(publish).toBeEnabled();
  await expect(main(page).getByTestId('setup-publish-reason')).toHaveCount(0);
  await publish.click();
  await page.getByRole('button', { name: 'Опубликовать', exact: true }).click();
  await expect(publish).toHaveText('Опубликовано', { timeout: 15_000 });
  await page.goto('/marketing/site');
  await expect(main(page).getByRole('heading', { level: 1 })).toHaveText('Публикация сайта');
  // тариф брони и источник брони ИИ-продавца гостиничные: у салона их нет
  await expect(main(page).getByTestId('publication-booking')).toHaveCount(0);
  await expect(main(page).getByLabel('Тариф брони')).toHaveCount(0);
});

test('ресторан: меню с ценами, чипы и три шаблона ресторана; создание по шаблону открывает редактор', async ({ page, request }) => {
  test.setTimeout(120_000);
  const food = '5a1c0000-0000-4000-8000-00000000f001';
  await signIn(page);
  await request.post(`${FIXTURE_API}/branches`, {
    headers: { 'x-wetop-test-client': '1' },
    data: { id: food, name: 'Ресторан Дастархан', address: 'пр. Абая, 10', currency: 'KZT', timezone: 'Asia/Almaty', vertical: 'FOOD_SERVICE' },
  });
  await site(request, { noSite: true });
  await page.goto('/marketing/site/editor');
  const win = main(page).getByTestId('create-site');
  await win.getByTestId('site-location').filter({ hasText: 'Ресторан Дастархан' }).click();
  await expect(win.getByRole('heading', { name: 'Сайт для Ресторан Дастархан' })).toBeVisible({ timeout: 30_000 });
  await expect(win.getByTestId('site-chip')).toHaveText(['Сайт с меню и бронью столов', 'Акцент на банкетах', 'Покажи бизнес-ланч']);
  await expect(win.getByTestId('site-facts-catalog')).toContainText('Бешбармак');
  await expect(win.getByTestId('site-facts-catalog')).toContainText('4 500 ₸');
  await expect(win.getByTestId('site-design-frame').first()).toHaveAttribute('srcdoc', /Ресторан Дастархан[\s\S]*Забронировать стол/);
  await expect.poll(async () => (await axe(page)).violations).toEqual([]);
  await paintPreviews(page);
  await page.screenshot({ path: `${SHOTS}/restaurant-light-1440.png`, fullPage: true });
  expect(await designIds(page)).toEqual(['food-cafe', 'food-restaurant', 'food-delivery']);
  await win.getByTestId('site-design-card').filter({ hasText: 'Ресторан' }).filter({ hasText: 'Вечерний' }).getByTestId('site-design-choose').click();
  await win.getByTestId('create-site-start').click();
  await expect(editor(page)).toBeVisible({ timeout: 15_000 });
  await expect(main(page).getByTestId('setup-template').getByTestId('site-design-card').filter({ hasText: 'Ресторан' }).filter({ hasText: 'Вечерний' }).getByRole('radio')).toHaveAttribute('aria-checked', 'true');
  await expect(page.frameLocator('[data-testid="ed-frame"]').locator('main')).toContainText('Бешбармак');
  // ресторан публикует сайт с бронью стола (SITE-5), без гостиничного тарифа
  const publish = main(page).getByTestId('setup-publish-btn');
  await expect(publish).toBeEnabled();
  await publish.click();
  await page.getByRole('button', { name: 'Опубликовать', exact: true }).click();
  await expect(publish).toHaveText('Опубликовано', { timeout: 15_000 });
  await page.goto('/marketing/site');
  await expect(main(page).getByTestId('publication-booking')).toHaveCount(0);
});

for (const theme of ['light', 'dark'] as const)
  test(`снимки и доступность первого экрана гостиницы: ${theme}, 1440 и 390`, async ({ page, request }) => {
    test.setTimeout(120_000);
    await site(request, { noSite: true });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.goto('/marketing/site/editor');
      await expect(main(page).getByTestId('site-design-frame')).toHaveCount(3);
      expect(await wide(page)).toEqual([]);
      // цели нажатия на телефоне не меньше 44 px: филиал, чипы, кнопки дизайна
      if (width === 390) {
        const small = await main(page)
          .locator('.site-location, .site-chat__chips .chip, .site-start__actions .btn, .site-facts__gaps .btn')
          .evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44).map((e) => e.textContent));
        expect(small).toEqual([]);
      }
      await expect.poll(async () => (await axe(page)).violations).toEqual([]);
      await paintPreviews(page);
      await page.screenshot({ path: `${SHOTS}/hotel-${theme}-${width}.png`, fullPage: true });
    }
  });
