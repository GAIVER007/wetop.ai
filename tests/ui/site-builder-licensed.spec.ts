import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { FIXTURE_API, expect, test, type Page } from './fixtures';

/**
 * MKT9.2 (plans/mkt9-2-licensed-lovable-builder-2026-10-08.md): лицензированный конструктор сайта. Проект это филиал;
 * без лицензии всё видно, но правка, ИИ и публикация закрыты; режимы «Чат / План / Сборка»; варианты оформления;
 * разговор на сервере; «Выбор / Текст» с правкой текста прямо на сайте; закладки версий; знания проекта; выдача
 * лицензии главным администратором. Стенд отвечает правилами API. Данные вымышленные (ADR-010).
 */
const SHOTS = 'reports/mkt9-2-licensed-lovable-builder-2026-10-08';
const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).exclude('[data-testid="ed-frame"]').analyze();
const main = (page: Page) => page.getByRole('main').filter({ visible: true });
const site = (request: { post: (url: string, o: { data: unknown }) => Promise<unknown> }, data: Record<string, unknown>) =>
  request.post(`${FIXTURE_API}/__test/marketing-site`, { data });
const frame = (page: Page) => main(page).frameLocator('[data-testid="ed-frame"]');
const tab = (page: Page, name: string) => main(page).getByRole('tab', { name, exact: true });
const mode = (page: Page, name: string) => main(page).getByTestId('ed-modes').getByRole('radio', { name, exact: true });
const ai = (page: Page) => main(page).getByTestId('ed-ai');
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const clean = async (page: Page) => expect((await axe(page)).violations).toEqual([]);

test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

test('лицензии нет: всё видно, правка, ИИ, «Текст» и сохранение закрыты; полоса проекта говорит почему', async ({ page, request }) => {
  await site(request, { license: 'OFF' });
  await page.goto('/marketing/site/editor');
  const m = main(page);
  await expect(m.getByTestId('ed-license')).toHaveText('Конструктор не подключён');
  await expect(m.getByTestId('ed-license-off')).toContainText('Конструктор сайта не активен для этого филиала.');
  await expect(m.getByTestId('ed-license-off')).toContainText('Опубликованный сайт продолжает работать');
  await expect(frame(page).locator('#sec-hero')).toBeVisible();
  await expect(m.getByTestId('ed-save')).toBeDisabled();
  await expect(m.getByTestId('ed-tool-text')).toBeDisabled();
  await expect(ai(page).getByLabel('Что изменить на сайте?')).toBeDisabled();
  await expect(ai(page).getByTestId('ed-ai-send')).toBeDisabled();
  // история открывается, восстановить нельзя
  await m.getByTestId('ed-history-open').click();
  await expect(page.getByTestId('ed-restore').first()).toBeDisabled();
  await page.keyboard.press('Escape');
  await clean(page);
  await shot(page, 'license-off-light-1440');
});

test('срок лицензии вышел: та же закрытая правка, слова «Срок лицензии вышел»; первый экран без лицензии', async ({ page, request }) => {
  await site(request, { license: 'EXPIRED' });
  await page.goto('/marketing/site/editor');
  await expect(main(page).getByTestId('ed-license')).toHaveText('Срок лицензии вышел');
  await expect(main(page).getByTestId('ed-license-off')).toContainText('Срок лицензии вышел.');
  await site(request, { license: 'OFF', noSite: true });
  await page.goto('/marketing/site/editor');
  const win = main(page).getByTestId('create-site');
  await expect(main(page).getByTestId('ed-license-off')).toBeVisible();
  await expect(win.getByTestId('create-site-start')).toBeDisabled();
  await expect(win.getByTestId('create-site-designs')).toBeDisabled();
});

test('режим «Чат»: ответ словами без новой версии, «Перейти в сборку»; разговор на сервере переживает обновление', async ({ page }) => {
  await page.goto('/marketing/site/editor');
  const m = main(page);
  await expect(mode(page, 'Сборка')).toHaveAttribute('aria-checked', 'true');
  await mode(page, 'Чат').click();
  await ai(page).getByLabel('Спросите ИИ о сайте').fill('Что улучшить на первом экране?');
  await ai(page).getByTestId('ed-ai-send').click();
  await expect(ai(page).getByTestId('ed-ai-answer')).toContainText('Первый экран можно сократить до одной строки');
  await expect(m.getByTestId('ed-revision')).toHaveText('версия 2');
  await page.reload();
  await expect(ai(page).getByTestId('ed-ai-answer')).toContainText('Первый экран можно сократить до одной строки');
  await ai(page).getByTestId('ed-go-build').click();
  await expect(mode(page, 'Сборка')).toHaveAttribute('aria-checked', 'true');
  await expect(ai(page).getByLabel('Что изменить на сайте?')).toHaveValue('Что улучшить на первом экране?');
});

test('режим «План»: вопросы с вариантами, план с шагами, правка текста сборки, «Собрать по плану» один раз', async ({ page }) => {
  await page.goto('/marketing/site/editor');
  const m = main(page);
  await mode(page, 'План').click();
  await ai(page).getByLabel('Что вы хотите получить?').fill('Хочу, чтобы сайт был короче');
  await ai(page).getByTestId('ed-ai-send').click();
  const questions = ai(page).getByTestId('ed-questions');
  await expect(questions).toContainText('Какой тон сайта?');
  await questions.getByRole('radio', { name: 'Тёплый' }).check();
  await questions.getByTestId('ed-questions-send').click();
  // ответ уходит с id задачи вопросов: сервер сам собирает исходную просьбу, вопросы и ответы
  await expect(ai(page).getByTestId('ed-feed')).toContainText('Исходный запрос:');
  await expect(ai(page).getByTestId('ed-feed')).toContainText('tone: Какой тон сайта?');
  await expect(ai(page).getByTestId('ed-feed')).toContainText('tone: Тёплый');
  const plan = ai(page).getByTestId('ed-plan');
  await expect(plan).toContainText('Короче первый экран и номера выше');
  await expect(plan).toContainText('Раздел «О нас» опустится ниже');
  await clean(page);
  await shot(page, 'plan-light-1440');
  await plan.getByLabel('Что ИИ сделает при сборке').fill('Сократи заголовок первого экрана.');
  await plan.getByTestId('ed-plan-approve').click();
  await expect(m.getByTestId('ed-ai-done')).toContainText('Готово: ИИ создал версию 3');
  await expect(ai(page).getByTestId('ed-plan-done')).toContainText('собрано по этому плану');
  await expect(ai(page).getByTestId('ed-feed')).toContainText('Сборка по плану');
  await page.reload();
  await expect(ai(page).getByTestId('ed-plan-done')).toBeVisible();
});

test('варианты оформления на первом экране: три карточки с выбором, сайт создаётся с выбранным оформлением', async ({ page, request }) => {
  await site(request, { noSite: true });
  await page.goto('/marketing/site/editor');
  const win = main(page).getByTestId('create-site');
  await win.getByLabel('Опишите, каким должен быть сайт').fill('Строго и по делу');
  await win.getByTestId('create-site-designs').click();
  const cards = win.getByTestId('ed-design');
  await expect(cards.getByRole('radio')).toHaveCount(3);
  await expect(cards.getByRole('radio', { name: /Тёплый дом/ })).toBeChecked();
  await cards.getByText('Ночной город').click();
  await expect(cards.getByRole('radio', { name: /Ночной город/ })).toBeChecked();
  await clean(page);
  await shot(page, 'design-cards-light-1440');
  await cards.getByTestId('ed-design-apply').click();
  await expect(main(page).getByTestId('site-editor')).toBeVisible({ timeout: 15_000 });
  await tab(page, 'Сайт').click();
  await expect(main(page).getByTestId('ed-theme').getByLabel('Настроение')).toHaveValue('NIGHT');
  // выбор виден и в разговоре: карточки можно применить к черновику ещё раз
  await tab(page, 'ИИ').click();
  await expect(ai(page).getByTestId('ed-design')).toBeVisible();
});

test('«Выбор / Текст»: T включает правку текста, Enter применяет в черновике, Escape отменяет; сохранение без ИИ', async ({ page }) => {
  await page.goto('/marketing/site/editor');
  const m = main(page);
  await expect(frame(page).locator('#sec-hero')).toBeVisible();
  await page.keyboard.press('t');
  await expect(m.getByTestId('ed-tool-text')).toHaveAttribute('aria-checked', 'true');
  await expect(m.getByTestId('ed-preview-hint')).toContainText('Цены, контакты и ссылки так не меняются');
  const heading = frame(page).locator('[data-editor-path="pages[0].sections[0].heading"]');
  await expect(heading).toHaveText('Версия 2');
  // контакты и цены метки не получают
  await expect(frame(page).locator('[data-editor-path*="phone"], [data-editor-path*="email"]')).toHaveCount(0);
  await clean(page);
  await shot(page, 'text-mode-light-1440');
  await heading.click();
  await expect(heading).toHaveAttribute('contenteditable', /plaintext-only|true/);
  await page.keyboard.type('Тихо у вокзала');
  await page.keyboard.press('Escape');
  await expect(frame(page).locator('[data-editor-path="pages[0].sections[0].heading"]')).toHaveText('Версия 2');
  await expect(m.getByTestId('ed-dirty')).toHaveText('Все изменения сохранены');
  await frame(page).locator('[data-editor-path="pages[0].sections[0].heading"]').click();
  await page.keyboard.type('Тихо у вокзала');
  await page.keyboard.press('Enter');
  await expect(m.getByTestId('ed-dirty')).toHaveText('Есть несохранённые изменения');
  await expect(frame(page).locator('#sec-hero')).toContainText('Тихо у вокзала');
  await page.keyboard.press('s');
  await expect(m.getByTestId('ed-tool-select')).toHaveAttribute('aria-checked', 'true');
  await m.getByTestId('ed-save').click();
  await expect(m.getByTestId('ed-message')).toHaveText('Черновик сохранён: версия 3');
  // ни одного запроса к ИИ: в разговоре пусто
  await expect(ai(page).getByTestId('ed-feed')).toHaveCount(0);
});

test('закладки: звёздочка с подписью, закреплённый список сверху, снять закладку', async ({ page }) => {
  await page.goto('/marketing/site/editor');
  await main(page).getByTestId('ed-history-open').click();
  const history = page.getByTestId('ed-history');
  const first = history.getByTestId('ed-history-row').nth(1);
  await first.getByTestId('ed-bookmark-add').click();
  await first.getByLabel('Подпись закладки версии 1').fill('Перед акцией');
  await first.getByTestId('ed-bookmark-save').click();
  await expect(history.getByTestId('ed-bookmarks')).toContainText('Перед акцией');
  await expect(history.getByTestId('ed-bookmark-row')).toHaveCount(1);
  await clean(page);
  await shot(page, 'bookmarks-light-1440');
  await history.getByTestId('ed-history-row').nth(1).getByTestId('ed-bookmark-remove').click();
  await expect(history.getByTestId('ed-bookmarks')).toHaveCount(0);
});

test('знания проекта: сохраняются отдельно от черновика и переживают обновление', async ({ page }) => {
  await page.goto('/marketing/site/editor');
  await tab(page, 'Сайт').click();
  const box = main(page).getByTestId('ed-knowledge');
  await box.getByLabel('Что ИИ должен всегда учитывать на этом сайте').fill('Тон спокойный, без восклицаний');
  await box.getByTestId('ed-knowledge-save').click();
  await expect(box.getByTestId('ed-knowledge-state')).toHaveText('Знания проекта сохранены: ИИ учтёт их в следующих запросах');
  await expect(main(page).getByTestId('ed-dirty')).toHaveText('Все изменения сохранены');
  await page.reload();
  await tab(page, 'Сайт').click();
  await expect(main(page).getByTestId('ed-knowledge').getByLabel('Что ИИ должен всегда учитывать на этом сайте')).toHaveValue('Тон спокойный, без восклицаний');
});

async function signIn(page: Page) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/finance');
}

test('«Платформа → Организации»: главный администратор выдаёт, продлевает и выключает конструктор филиала', async ({ page, request }) => {
  await signIn(page);
  await request.post(`${FIXTURE_API}/__test/control`, { data: { platformAdmin: true } });
  await page.goto('/platform?org=ui-org');
  const list = page.getByTestId('platform-site-builder');
  const forms = list.getByTestId('platform-site-builder-form');
  await expect(forms).toHaveCount(2);
  await expect(forms.nth(0)).toContainText('Luxx Aparts');
  await expect(forms.nth(0)).toContainText('Действует');
  await expect(forms.nth(1)).toContainText('Marina');
  await expect(forms.nth(1)).toContainText('Не подключён');
  await forms.nth(1).getByTestId('platform-site-builder-trial').click();
  await expect(forms.nth(1).getByTestId('platform-site-builder-error')).toHaveText('У пробного доступа нужен срок');
  const day = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  await list.getByTestId('platform-site-builder-form').nth(1).getByLabel('Действует по (включительно)').fill(day);
  await list.getByTestId('platform-site-builder-form').nth(1).getByTestId('platform-site-builder-trial').click();
  await expect(list.getByTestId('platform-site-builder-form').nth(1).getByTestId('platform-site-builder-result')).toContainText('Marina» действует');
  await expect(list.getByTestId('platform-site-builder-form').nth(1)).toContainText('пробный');
  await clean(page);
  await shot(page, 'platform-licenses-light-1440');
  await list.getByTestId('platform-site-builder-form').nth(0).getByTestId('platform-site-builder-off').click();
  await expect(list.getByTestId('platform-site-builder-form').nth(0).getByTestId('platform-site-builder-result')).toContainText('Luxx Aparts» выключен');
  // филиал сразу видит сайт только для чтения
  await page.goto('/marketing/site/editor');
  await expect(main(page).getByTestId('ed-license')).toHaveText('Конструктор не подключён');
});

for (const theme of ['light', 'dark'] as const)
  test(`снимки и доступность ключевых состояний: ${theme}`, async ({ page, request }) => {
    test.setTimeout(150_000);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      const wide = () =>
        page.evaluate(() =>
          [...document.querySelectorAll('main *')]
            .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
            .slice(0, 5)
            .map((el) => `${el.tagName}.${el.className}`),
        );
      await request.post(`${FIXTURE_API}/__test/reset`);
      await site(request, { noSite: true });
      await page.goto('/marketing/site/editor');
      await expect(main(page).getByTestId('create-site')).toBeVisible();
      expect(await wide()).toEqual([]);
      await clean(page);
      await shot(page, `first-screen-${theme}-${width}`);

      await request.post(`${FIXTURE_API}/__test/reset`);
      await page.goto('/marketing/site/editor');
      await expect(main(page).getByTestId('ed-project')).toContainText('Luxx Aparts');
      if (width === 390) await expect(tab(page, 'ИИ')).toHaveAttribute('aria-selected', 'true');
      else await expect(frame(page).locator('#sec-hero')).toBeVisible();
      await mode(page, 'Чат').click();
      await ai(page).getByLabel('Спросите ИИ о сайте').fill('Что улучшить?');
      await ai(page).getByTestId('ed-ai-send').click();
      await expect(ai(page).getByTestId('ed-ai-answer')).toBeVisible();
      expect(await wide()).toEqual([]);
      await clean(page);
      await shot(page, `editor-chat-${theme}-${width}`);

      await request.post(`${FIXTURE_API}/__test/marketing-site`, { data: { license: 'OFF' } });
      await page.goto('/marketing/site/editor');
      await expect(main(page).getByTestId('ed-license-off')).toBeVisible();
      expect(await wide()).toEqual([]);
      await clean(page);
      await shot(page, `license-off-${theme}-${width}`);
    }
  });
