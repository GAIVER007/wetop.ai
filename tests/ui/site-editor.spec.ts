import { FIXTURE_API, expect, test, devNoise, type Page } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

/**
 * MKT9 (plans/mkt9-site-editor-ai-edits-2026-10-07.md §6, ТЗ §151): редактор сайта. Голова черновика правится формами,
 * сохранение даёт новую версию, ошибки и конфликт ввод не стирают, история с разницей и восстановлением, выбор
 * картинок из библиотеки, галерея, ИИ-правки всего сайта и секции. Данные вымышленные (ADR-010).
 */
const SHOTS = 'reports/mkt9-site-editor-2026-10-07';
/**
 * axe без рамки живого просмотра: в ней скрипты запрещены песочницей, и axe внутри зависает. Сам сайт проверяется axe по
 * выходу Worker (`tests/sites`), здесь проверяется стойка вокруг него
 */
const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).exclude('[data-testid="ed-frame"]').analyze();
const main = (page: Page) => page.getByRole('main').filter({ visible: true });
const control = (request: { post: (url: string, o: { data: unknown }) => Promise<unknown> }, data: Record<string, unknown>) =>
  request.post(`${FIXTURE_API}/__test/marketing-site`, { data });
const heroHeading = (page: Page) => main(page).getByLabel('Заголовок секции', { exact: true });
const structure = (page: Page) => main(page).getByTestId('ed-structure');
const frame = (page: Page) => main(page).frameLocator('[data-testid="ed-frame"]');
const tab = (page: Page, name: string) => main(page).getByRole('tab', { name, exact: true });
/** Блок выбирается щелчком по нему на живом сайте справа, как в конструкторе */
const pick = async (page: Page, sectionId: string) => frame(page).locator(`#${sectionId}`).click();
/** Блок по списку во вкладке «Блоки» */
const openBlock = async (page: Page, name: string) => {
  await tab(page, 'Блоки').click();
  const back = main(page).getByTestId('ed-back');
  if (await back.isVisible()) await back.click();
  await structure(page).getByRole('button', { name, exact: true }).click();
};

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

test('открыть голову: щелчок по блоку на сайте, правка видна сразу, сохранить; история и разница словами', async ({ page }) => {
  await page.goto('/marketing/site/editor');
  const m = main(page);
  await expect(m.getByRole('heading', { level: 1 })).toHaveText('Редактор сайта');
  await expect(m.getByTestId('ed-revision')).toHaveText('версия 2');
  await expect(m.getByTestId('ed-dirty')).toHaveText('Все изменения сохранены');
  await expect(m.getByTestId('ed-save')).toBeDisabled();
  // по умолчанию слева ИИ, справа живой сайт
  await expect(tab(page, 'ИИ')).toHaveAttribute('aria-selected', 'true');
  await expect(frame(page).locator('#sec-hero')).toContainText('Версия 2');
  await pick(page, 'sec-hero');
  await expect(tab(page, 'Блоки')).toHaveAttribute('aria-selected', 'true');
  await expect(heroHeading(page)).toHaveValue('Версия 2');
  await expect(frame(page).locator('#sec-hero')).toHaveAttribute('data-ed-selected', '');
  // JSON-редактора нет: только поля форм
  await expect(m.locator('textarea').filter({ hasText: 'schemaVersion' })).toHaveCount(0);

  await heroHeading(page).fill('Новый первый экран');
  // живой просмотр по документу на экране, без сохранения
  await expect(frame(page).locator('#sec-hero')).toContainText('Новый первый экран');
  await expect(m.getByTestId('ed-dirty')).toHaveText('Есть несохранённые изменения');
  await m.getByTestId('ed-save').click();
  await expect(m.getByTestId('ed-message')).toHaveText('Черновик сохранён: версия 3');
  await expect(m.getByTestId('ed-revision')).toHaveText('версия 3');
  await expect(m.getByTestId('ed-dirty')).toHaveText('Все изменения сохранены');

  await m.getByTestId('ed-history-open').click();
  const history = page.getByTestId('ed-history');
  await expect(history.getByTestId('ed-history-row')).toHaveCount(3);
  await expect(history.getByTestId('ed-history-row').first()).toContainText('Версия 3');
  await expect(history.getByTestId('ed-history-row').first()).toContainText('Черновик');
  await history.getByTestId('ed-history-row').nth(2).getByRole('button', { name: 'Сравнить с черновиком' }).click();
  const diff = page.getByTestId('ed-diff');
  await expect(diff).toContainText('Секция «Новый первый экран»: изменено содержимое');
  await expect(diff).not.toContainText('{');
});

test('просмотр: ссылка подвала на страницу сайта переключает страницу, скрипты сайта не выполняются, наружу не уходит', async ({ page }) => {
  await page.goto('/marketing/site/editor');
  const m = main(page);
  await expect(frame(page).locator('#sec-hero')).toBeVisible();
  await frame(page).locator('footer').getByRole('link', { name: 'Правила' }).click();
  await expect(frame(page).locator('#sec-rules')).toContainText('Правила проживания');
  await expect(m.locator('#ed-preview-page')).toHaveValue('page-rules');
  await expect(page).toHaveURL(/\/marketing\/site\/editor$/);
  await tab(page, 'Блоки').click();
  await expect(structure(page).getByRole('button', { name: 'О гостинице: Правила проживания', exact: true })).toBeVisible();
  await m.locator('#ed-preview-page').selectOption({ label: 'Главная' });
  await expect(frame(page).locator('#sec-hero')).toBeVisible();
  await expect(frame(page).locator('script[src]')).toHaveCount(0);
  await expect(m.locator('[data-testid="ed-frame"]')).toHaveAttribute('sandbox', 'allow-same-origin');
  await m.getByRole('button', { name: 'Телефон' }).click();
  await expect(m.getByRole('button', { name: 'Телефон' })).toHaveAttribute('aria-pressed', 'true');
});

test('открыть в новой вкладке: с несохранёнными правками просит сохранить, без них открывает ссылку', async ({ page }) => {
  await page.goto('/marketing/site/editor');
  const m = main(page);
  await pick(page, 'sec-hero');
  await heroHeading(page).fill('Ещё не сохранено');
  await m.getByTestId('ed-preview').click();
  await expect(m.getByTestId('ed-message')).toHaveText('Сначала сохраните черновик.');
  await m.getByTestId('ed-save').click();
  await expect(m.getByTestId('ed-message')).toContainText('сохранён');
  await page.context().route('https://preview.sites.test/**', (route) => route.fulfill({ body: 'preview', contentType: 'text/plain' }));
  const popup = page.waitForEvent('popup');
  await m.getByTestId('ed-preview').click();
  await (await popup).waitForURL(/preview\.sites\.test/);
});

test('восстановить старую версию как новый черновик', async ({ page }) => {
  await page.goto('/marketing/site/editor');
  const m = main(page);
  await m.getByTestId('ed-history-open').click();
  await page.getByTestId('ed-history').getByTestId('ed-history-row').nth(1).getByTestId('ed-restore').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Восстановить', exact: true }).click();
  await expect(m.getByTestId('ed-message')).toHaveText('Версия 1 восстановлена как черновик: версия 3');
  await expect(m.getByTestId('ed-revision')).toHaveText('версия 3');
  await expect(frame(page).locator('#sec-hero')).toContainText('Тихие номера у вокзала');
  await pick(page, 'sec-hero');
  await expect(heroHeading(page)).toHaveValue('Тихие номера у вокзала');
});

test('выбор картинки: только готовые нужного вида из библиотеки, URL руками не вводится; ALT отдельно', async ({ page }) => {
  await page.goto('/marketing/site/editor');
  const m = main(page);
  await pick(page, 'sec-hero');
  await m.getByRole('button', { name: 'Заменить изображение' }).first().click();
  const picker = page.getByTestId('ed-asset-picker');
  await expect(picker.getByTestId('ed-asset-option')).toHaveCount(2);
  await picker.getByTestId('ed-asset-option').nth(1).click();
  await expect(picker).toBeHidden();
  await expect(m.getByLabel('Подпись для незрячих (ALT)', { exact: true })).toHaveValue('Фасад вечером');
  await expect(m.getByTestId('ed-dirty')).toHaveText('Есть несохранённые изменения');
  await expect(m.locator('input[type="url"]')).toHaveCount(0);

  await tab(page, 'Сайт').click();
  await m.getByRole('button', { name: 'Заменить изображение' }).first().click();
  await expect(page.getByTestId('ed-asset-picker').getByTestId('ed-asset-option')).toHaveCount(1);
});

test('галерея: добавить, переставить, подписать и убрать; сохраняется', async ({ page }) => {
  await page.goto('/marketing/site/editor');
  const m = main(page);
  await openBlock(page, 'Галерея: Фото');
  const items = m.getByTestId('ed-gallery-item');
  await expect(items).toHaveCount(3);
  await m.getByTestId('ed-gallery-add').click();
  await page.getByTestId('ed-asset-picker').getByTestId('ed-asset-option').nth(1).click();
  await expect(items).toHaveCount(4);
  await m.getByLabel('Подпись изображения 4 (ALT)').fill('Двухместный номер');
  await m.getByRole('button', { name: 'Изображение 4: выше' }).click();
  await expect(m.getByLabel('Подпись изображения 3 (ALT)')).toHaveValue('Двухместный номер');
  await m.getByRole('button', { name: 'Изображение 1: удалить' }).click();
  await expect(items).toHaveCount(3);
  await m.getByTestId('ed-save').click();
  await expect(m.getByTestId('ed-message')).toHaveText('Черновик сохранён: версия 3');
});

test('ошибка проверки: ввод на месте, сводка ведёт к полю', async ({ page }) => {
  await page.goto('/marketing/site/editor');
  const m = main(page);
  await pick(page, 'sec-about');
  await m.getByLabel('Абзацы: 1').fill('Мой новый текст о гостинице');
  await m.getByLabel('Заголовок секции', { exact: true }).fill('');
  await m.getByTestId('ed-save').click();
  await expect(m.getByTestId('ed-message')).toHaveText('Черновик не сохранён: исправьте отмеченные поля');
  await expect(m.getByTestId('ed-errors')).toContainText('Страница «Главная», о гостинице: Обязательное поле');
  // ошибка и у самого поля, связана с ним (aria-invalid)
  const heading = m.getByRole('textbox', { name: /^Заголовок секции/ });
  await expect(heading).toHaveAttribute('aria-invalid', 'true');
  await expect(m.getByLabel('Абзацы: 1')).toHaveValue('Мой новый текст о гостинице');
  await expect(m.getByTestId('ed-revision')).toHaveText('версия 2');
  await tab(page, 'Сайт').click();
  await m.getByTestId('ed-errors').getByRole('button').first().click();
  await expect(heading).toBeFocused();
});

test('конфликт 409: правки остаются, сравнение, продолжить со своими и сохранить', async ({ page, request }) => {
  await page.goto('/marketing/site/editor');
  const m = main(page);
  await openBlock(page, 'О гостинице: О нас');
  await m.getByLabel('Абзацы: 1').fill('Мои правки');
  await control(request, { addRevision: true });
  await m.getByTestId('ed-save').click();
  await expect(m.getByTestId('ed-conflict')).toContainText('Сайт уже изменён в другой вкладке или ИИ. Ваши изменения остались на экране.');
  await expect(m.getByLabel('Абзацы: 1')).toHaveValue('Мои правки');
  await m.getByTestId('ed-conflict-compare').click();
  await expect(page.getByTestId('ed-diff')).toContainText('изменено содержимое');
  await page.getByRole('dialog').getByRole('button', { name: /Закрыть/ }).click();
  await m.getByTestId('ed-conflict-continue').click();
  await expect(m.getByTestId('ed-message')).toHaveText('Ваши правки будут сохранены поверх версии 3');
  await m.getByTestId('ed-save').click();
  await expect(m.getByTestId('ed-message')).toHaveText('Черновик сохранён: версия 4');
});

test('удаление: страницу, на которую ссылается подвал, удалить нельзя; ссылки показаны', async ({ page }) => {
  await page.goto('/marketing/site/editor');
  const m = main(page);
  await tab(page, 'Блоки').click();
  await structure(page).getByRole('button', { name: 'Страница «Правила»: удалить' }).click();
  await expect(m.getByTestId('ed-blocked')).toContainText('Подвал: Правила');
  await expect(structure(page).getByTestId('ed-page')).toHaveCount(2);
  await expect(structure(page).getByRole('button', { name: 'Страница «Главная»: удалить' })).toBeDisabled();
});

test('добавить секцию, переставить и сделать копию с клавиатуры', async ({ page }) => {
  await page.goto('/marketing/site/editor');
  const m = main(page);
  await tab(page, 'Блоки').click();
  const sections = structure(page).getByTestId('ed-section');
  await expect(sections).toHaveCount(5);
  await structure(page).getByLabel('Новая секция').selectOption('faq');
  await m.getByTestId('ed-add-section').click();
  await expect(m.getByTestId('ed-section-form')).toContainText('Вопросы и ответы');
  await expect(frame(page).locator('main section')).toHaveCount(6);
  await m.getByTestId('ed-back').click();
  await expect(sections).toHaveCount(6);
  const up = structure(page).getByRole('button', { name: 'Вопросы и ответы: Вопросы и ответы: выше' });
  await up.focus();
  await page.keyboard.press('Enter');
  await m.getByTestId('ed-back').click();
  await expect(sections.nth(4)).toContainText('Вопросы и ответы');
  await structure(page).getByRole('button', { name: 'О гостинице: О нас: копия' }).click();
  await m.getByTestId('ed-back').click();
  await expect(sections).toHaveCount(7);
});

test('уход со страницы с правками спрашивает; отказ оставляет на месте', async ({ page }) => {
  await page.goto('/marketing/site/editor');
  const m = main(page);
  await pick(page, 'sec-hero');
  await heroHeading(page).fill('Не ушло');
  await m.getByRole('link', { name: 'Публикация' }).first().click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Уйти без сохранения?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Остаться' }).click();
  await expect(page).toHaveURL(/\/marketing\/site\/editor$/);
  await expect(heroHeading(page)).toHaveValue('Не ушло');
});

test('ИИ всего сайта: запрос в ленте, в очереди → готово, сайт справа обновился, разница, вернуть как было', async ({ page }) => {
  await page.goto('/marketing/site/editor');
  const m = main(page);
  const ai = m.getByTestId('ed-ai');
  await expect(ai).toContainText('Напишите, что поменять на сайте.');
  await expect(ai.getByTestId('ed-ai-send')).toBeDisabled();
  await ai.getByLabel('Что изменить на сайте?').fill('Сделай первый экран короче');
  await ai.getByTestId('ed-ai-send').click();
  await expect(ai.getByRole('list', { name: 'Разговор с ИИ' })).toContainText('Сделай первый экран короче');
  await expect(ai.getByLabel('Что изменить на сайте?')).toHaveValue('');
  await expect(m.getByTestId('ed-ai-state')).toContainText('Если сохранить изменения сейчас, результат ИИ не применится.');
  await expect(m.getByTestId('ed-ai-done')).toContainText('Готово: ИИ создал версию 3');
  await expect(m.getByTestId('ed-revision')).toHaveText('версия 3');
  await expect(frame(page).locator('#sec-hero')).toContainText('Короче и про расположение');
  await m.getByTestId('ed-ai-done').getByRole('button', { name: 'Что изменилось' }).click();
  await expect(page.getByTestId('ed-diff')).toContainText('Слоган: изменено');
  await page.keyboard.press('Escape');
  await m.getByTestId('ed-ai-done').getByRole('button', { name: 'Вернуть как было' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Вернуть', exact: true }).click();
  await expect(m.getByTestId('ed-message')).toHaveText('Версия 2 восстановлена как черновик: версия 4');
  await expect(frame(page).locator('#sec-hero')).toContainText('Версия 2');
  // MKT9.2: разговор хранится на сервере и виден после обновления вкладки
  await page.reload();
  await expect(main(page).getByTestId('ed-ai')).toContainText('Сделай первый экран короче');
});

test('ИИ одного блока: щелчок по блоку на сайте, «Изменить этот блок с ИИ», метка блока, команда необязательна', async ({ page }) => {
  await page.goto('/marketing/site/editor');
  const m = main(page);
  await pick(page, 'sec-about');
  await m.getByTestId('ed-ai-section').click();
  await expect(tab(page, 'ИИ')).toHaveAttribute('aria-selected', 'true');
  const ai = m.getByTestId('ed-ai');
  await expect(ai.getByTestId('ed-ai-target')).toContainText('Блок «О гостинице: О нас»');
  await expect(ai.getByLabel('Что изменить в этом блоке?')).toBeVisible();
  await ai.getByTestId('ed-ai-send').click();
  await expect(m.getByTestId('ed-ai-done')).toContainText('Готово: ИИ создал версию 3');
  await expect(frame(page).locator('#sec-about')).toContainText('Секция от ИИ');
  // «Весь сайт» снимает метку: следующий запрос про весь сайт
  await ai.getByRole('button', { name: 'Убрать блок: изменить весь сайт' }).click();
  await expect(ai.getByTestId('ed-ai-target')).toHaveCount(0);
  await expect(ai.getByLabel('Что изменить на сайте?')).toBeVisible();
});

test('ИИ с несохранёнными правками: «Сохранить и отправить» сохраняет версию, ошибка ИИ словами, «Повторить запрос»', async ({ page, request }) => {
  await control(request, { aiFail: 'BUDGET_EXCEEDED' });
  await page.goto('/marketing/site/editor');
  const m = main(page);
  await pick(page, 'sec-hero');
  await heroHeading(page).fill('Правка');
  await tab(page, 'ИИ').click();
  const ai = m.getByTestId('ed-ai');
  await expect(ai.getByTestId('ed-ai-send')).toHaveText('Сохранить и отправить');
  await ai.getByLabel('Что изменить в этом блоке?').fill('Ярче');
  await ai.getByTestId('ed-ai-send').click();
  await expect(m.getByTestId('ed-revision')).toHaveText('версия 3');
  await expect(m.getByTestId('ed-ai-error').last()).toContainText('Дневной лимит генерации сайтов исчерпан: попробуйте завтра');
  await ai.getByRole('button', { name: 'Повторить запрос' }).last().click();
  await expect(ai.getByLabel('Что изменить в этом блоке?')).toHaveValue('Ярче');
});

test('первый экран MKT9.2: «Сайт для …», без названия, адреса и примеров; факты филиала; сайт создаётся и открывается редактор', async ({ page, request }) => {
  await control(request, { noSite: true });
  await page.goto('/marketing/site/editor');
  const m = main(page);
  const win = m.getByTestId('create-site');
  await expect(win.getByRole('heading', { name: 'Сайт для Luxx Aparts' })).toBeVisible();
  // проект это филиал: ни названия, ни адреса сайта не спрашиваем, готовых примеров нет
  await expect(win.getByLabel('Адрес сайта')).toHaveCount(0);
  await expect(win.getByLabel('Название сайта')).toHaveCount(0);
  await expect(win.getByRole('list', { name: 'Примеры описаний' })).toHaveCount(0);
  await expect(win.getByRole('button')).toHaveText(['Показать варианты оформления', 'Создать сайт']);
  await expect(win.getByTestId('create-site-facts')).toContainText('Номера: Стандарт, Койка в общем номере');
  await expect(win.getByTestId('create-site-facts')).toContainText('Адрес: ул. Вымышленная, 1');
  await win.getByLabel('Опишите, каким должен быть сайт').fill('Спокойный сайт у вокзала');
  await win.getByTestId('create-site-start').click();
  await expect(win.getByTestId('create-site-steps')).toContainText('Анализирую данные объекта');
  await expect(m.getByTestId('site-editor')).toBeVisible({ timeout: 15_000 });
  await expect(frame(page).locator('#sec-hero')).toContainText('Первая версия от ИИ');
  await expect(m.getByTestId('ed-project')).toContainText('Luxx Aparts / Сайт филиала');
});

test('первый экран: сайт есть без версий; ошибка ИИ словами, текст на месте', async ({ page, request }) => {
  await control(request, { noVersions: true, aiFail: 'TIMEOUT' });
  await page.goto('/marketing/site/editor');
  const win = main(page).getByTestId('create-site');
  await expect(win.getByLabel('Адрес сайта')).toHaveCount(0);
  await win.getByLabel('Опишите, каким должен быть сайт').fill('Коротко и по делу');
  await win.getByLabel('Опишите, каким должен быть сайт').press('Control+Enter');
  await expect(win.getByTestId('create-site-error')).toHaveText('ИИ не ответил вовремя');
  await expect(win.getByLabel('Опишите, каким должен быть сайт')).toHaveValue('Коротко и по делу');
  await expect(win.getByTestId('create-site-start')).toBeEnabled();
});

for (const theme of ['light', 'dark'] as const)
  test(`окно «Создать сайт»: снимки и доступность, ${theme}`, async ({ page, request }) => {
    test.setTimeout(90_000);
    mkdirSync(SHOTS, { recursive: true });
    await control(request, { noSite: true });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.goto('/marketing/site/editor');
      await expect(main(page).getByTestId('create-site')).toBeVisible();
      const wide = await page.evaluate(() =>
        [...document.querySelectorAll('main *')].filter((el) => el.getBoundingClientRect().right > innerWidth + 1).length,
      );
      expect(wide).toBe(0);
      const audit = await axe(page);
      expect(audit.violations).toEqual([]);
      await page.screenshot({ path: `${SHOTS}/create-${theme}-${width}.png`, fullPage: true });
    }
  });

for (const theme of ['light', 'dark'] as const) {
  test(`редактор на компьютере, доступность и снимки: ${theme}`, async ({ page }) => {
    test.setTimeout(120_000);
    mkdirSync(SHOTS, { recursive: true });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      if (!devNoise.test(error.message)) errors.push(error.message);
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/marketing/site/editor');
    const audit = async () => {
      const result = await axe(page);
      expect(result.violations).toEqual([]);
    };
    await expect(main(page).getByTestId('site-editor')).toBeVisible();
    await expect(frame(page).locator('#sec-hero')).toBeVisible();
    await audit();
    await page.screenshot({ path: `${SHOTS}/editor-${theme}-1440.png` });
    await pick(page, 'sec-about');
    await expect(main(page).getByTestId('ed-section-form')).toBeVisible();
    await audit();
    await page.screenshot({ path: `${SHOTS}/block-${theme}-1440.png` });
    await tab(page, 'Сайт').click();
    await audit();
    if (theme === 'light') {
      await main(page).getByTestId('ed-history-open').click();
      await expect(page.getByTestId('ed-history-row')).toHaveCount(2);
      await audit();
      await page.screenshot({ path: `${SHOTS}/history-${theme}-1440.png` });
      await page.getByTestId('ed-history-row').nth(1).getByRole('button', { name: 'Сравнить с черновиком' }).click();
      await expect(page.getByTestId('ed-diff')).toBeVisible();
      await audit();
      await page.screenshot({ path: `${SHOTS}/diff-${theme}-1440.png` });
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      await main(page).getByRole('button', { name: 'Заменить изображение' }).first().click();
      await expect(page.getByTestId('ed-asset-picker')).toBeVisible();
      await audit();
      await page.screenshot({ path: `${SHOTS}/picker-${theme}-1440.png` });
      await page.keyboard.press('Escape');
      await tab(page, 'ИИ').click();
      await main(page).getByTestId('ed-ai').getByRole('button', { name: 'Убрать блок: изменить весь сайт' }).click();
      await main(page).getByTestId('ed-ai').getByLabel('Что изменить на сайте?').fill('Сделай первый экран короче');
      await main(page).getByTestId('ed-ai-send').click();
      await expect(main(page).getByTestId('ed-ai-state')).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/ai-${theme}-1440.png` });
      await expect(main(page).getByTestId('ed-ai-done')).toBeVisible();
      await audit();
      await page.screenshot({ path: `${SHOTS}/ai-done-${theme}-1440.png` });
    }
    expect(errors).toEqual([]);
  });

  test(`редактор на телефоне 390: вкладки, просмотр отдельной вкладкой, без вылета вбок, доступность: ${theme}`, async ({ page }) => {
    test.setTimeout(120_000);
    mkdirSync(SHOTS, { recursive: true });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/marketing/site/editor');
    const m = main(page);
    const wide = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('main *')]
          .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
          .slice(0, 5)
          .map((el) => `${el.tagName}.${el.className} ${Math.round(el.getBoundingClientRect().right)}`),
      );
    const audit = async () => {
      const result = await axe(page);
      expect(result.violations).toEqual([]);
    };
    await expect(tab(page, 'ИИ')).toHaveAttribute('aria-selected', 'true');
    await expect(m.getByTestId('ed-ai')).toBeVisible();
    await expect(m.getByTestId('ed-preview-pane')).toBeHidden();
    expect(await wide()).toEqual([]);
    await page.screenshot({ path: `${SHOTS}/mobile-ai-${theme}-390.png`, fullPage: true });
    await tab(page, 'Просмотр').click();
    await expect(frame(page).locator('#sec-hero')).toBeVisible();
    expect(await wide()).toEqual([]);
    await page.screenshot({ path: `${SHOTS}/mobile-preview-${theme}-390.png`, fullPage: true });
    await audit();
    await pick(page, 'sec-rooms');
    await expect(tab(page, 'Блоки')).toHaveAttribute('aria-selected', 'true');
    await expect(m.getByLabel('Категория гостиницы')).toHaveValue('std');
    await heroHeading(page).fill('Номера и цены');
    await expect(m.getByTestId('ed-bar')).toContainText('Есть несохранённые изменения');
    await m.getByTestId('ed-bar').getByRole('button', { name: 'Сохранить черновик' }).click();
    await expect(m.getByTestId('ed-message')).toHaveText('Черновик сохранён: версия 3');
    expect(await wide()).toEqual([]);
    await page.screenshot({ path: `${SHOTS}/mobile-form-${theme}-390.png`, fullPage: true });
    await m.getByTestId('ed-back').click();
    await expect(m.getByTestId('ed-structure')).toBeVisible();
    expect(await wide()).toEqual([]);
    await page.screenshot({ path: `${SHOTS}/mobile-structure-${theme}-390.png`, fullPage: true });
    await audit();
    await tab(page, 'Сайт').click();
    expect(await wide()).toEqual([]);
    await audit();
  });
}
