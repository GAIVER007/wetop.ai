import { expect, test } from './fixtures';

/**
 * Раздел «ИИ-продавец» (ТЗ ред. 1 §4.1, П6; приёмка §4.4), браузер → `next dev` → синтетический API с подставным
 * продавцом (`scripts/preview/fixture-api.ts`). Это проверка экранов и серверных действий стойки, а не правил API —
 * те закрыты тестами контроллера (`apps/api/src/ai-seller`). Гости и переписка — вымышленные (ADR-010).
 */
const API = 'http://127.0.0.1:4311';
const DIALOG = '3f2a1b0c-9d8e-4f7a-8b6c-5d4e3f2a1b0c';

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

test('раздел в меню «Продажи», шесть вкладок, полоса состояния', async ({ page }) => {
  await page.goto('/ai-seller');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ИИ-продавец');
  // меню раскрывает группу текущего раздела и подсвечивает его (DESIGN.md §8, боковое меню)
  const sidebar = page.locator('.workspace-sidebar');
  await expect(sidebar.getByRole('button', { name: 'Продажи', exact: true })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await expect(sidebar.locator('[aria-current="page"]')).toHaveText('ИИ-продавец');
  const tabs = page.getByRole('navigation', { name: 'ИИ-продавец' }).getByRole('link');
  await expect(tabs).toHaveText([
    'Настройки',
    'Данные объекта',
    'Знания',
    'Диалоги',
    'Код для сайта',
    'Проверка',
  ]);
  await expect(page.getByTestId('seller-state')).toContainText('Продавец ещё не настроен');
});

test('«вы» → «ты», «Применить» — следующий ответ в «Проверке» на «ты» (ТЗ §4.4)', async ({ page }) => {
  await page.goto('/ai-seller/check');
  await page.getByTestId('sandbox-text').fill('Здравствуйте, есть места?');
  await page.getByTestId('sandbox-send').click();
  await expect(page.getByTestId('sandbox-history')).toContainText('Чем могу вам помочь?');

  await page.goto('/ai-seller');
  await page.getByLabel('Обращение к гостю').selectOption('INFORMAL');
  await page.getByLabel('Имя бота').fill('Айгерим');
  await page.getByTestId('seller-faq-add').click();
  await page.getByLabel('Вопрос 1').fill('Есть ли парковка?');
  await page.getByLabel('Ответ 1').fill('Парковки нет, рядом городская.');
  await page.getByTestId('seller-apply').click();
  await expect(page.getByTestId('seller-apply-result')).toHaveText(
    'Применено: продавец получил настройки и данные объекта.',
  );
  await expect(page.getByTestId('seller-state')).toContainText(
    'Продавец работает с текущими настройками',
  );

  await page.getByRole('navigation', { name: 'ИИ-продавец' }).getByRole('link', { name: 'Проверка' }).click();
  await page.getByTestId('sandbox-text').fill('Есть места на выходные?');
  await page.getByTestId('sandbox-send').click();
  await expect(page.getByTestId('sandbox-history')).toContainText('Чем могу тебе помочь?');
});

test('эмодзи — из трёх вариантов бота, запреты — по одному в строке; после перезагрузки всё на месте (ADR-076)', async ({
  page,
}) => {
  await page.goto('/ai-seller');
  const emoji = page.getByLabel('Эмодзи');
  await expect(emoji.locator('option')).toHaveText(['без эмодзи', 'изредка', 'только в приветствии']);
  await expect(page.getByLabel('Длина реплик').locator('option')).toHaveText(['коротко', 'развёрнуто']);
  await emoji.selectOption('GREETING_ONLY');
  await page.getByLabel('Запреты — по одному в строке').fill('Не курить в номерах\n\nБез животных');
  await page.getByLabel('Когда звать человека — по одному в строке').fill('Группа от 6 человек');
  await page.getByTestId('seller-apply').click();
  await expect(page.getByTestId('seller-apply-result')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Эмодзи')).toHaveValue('GREETING_ONLY');
  // пустая строка — не правило: у продавца список из двух запретов
  await expect(page.getByLabel('Запреты — по одному в строке')).toHaveValue('Не курить в номерах\nБез животных');
  await expect(page.getByLabel('Когда звать человека — по одному в строке')).toHaveValue('Группа от 6 человек');
});

test('без языков «Применить» отказывает словами продавца, введённое не пропадает', async ({ page }) => {
  await page.goto('/ai-seller');
  await page.getByLabel('Имя бота').fill('Айгерим');
  await page.getByRole('checkbox', { name: 'Русский' }).uncheck();
  await page.getByTestId('seller-apply').click();
  await expect(page.getByTestId('seller-apply-error')).toHaveText('Языки: нужен хотя бы один');
  await expect(page.getByLabel('Имя бота')).toHaveValue('Айгерим');
});

test('«Данные объекта» — только просмотр: факты, цены по категориям, куда идти править', async ({ page }) => {
  await page.goto('/ai-seller/data');
  const facts = page.getByTestId('seller-facts');
  await expect(facts).toContainText('Алматы, ул. Тестовая, 1');
  await expect(facts).toContainText('14:00');
  const table = page.getByRole('region', { name: 'Категории и цены продавца' });
  await expect(table).toContainText('Двухместный номер');
  // одна цена весь срок — её продавец и называет; меняется — «уточнит администратор» (ADR-076, Q-179)
  await expect(table.getByRole('row', { name: /Двухместный номер/ })).toContainText('15 000 ₸ за ночь за 2 гостей');
  await expect(table.getByRole('row', { name: /Мужской общий номер/ })).toContainText(
    'уточнит администратор — цена меняется по датам: от 4 500 ₸ до 5 200 ₸',
  );
  await expect(page.getByRole('link', { name: 'Изменить карточку объекта' })).toHaveAttribute(
    'href',
    '/hotel-settings',
  );
  await expect(page.getByRole('link', { name: 'Изменить цены в «Тарифах»' })).toHaveAttribute(
    'href',
    '/rates',
  );
});

test('«Знания»: список и загрузка документа', async ({ page }) => {
  await page.goto('/ai-seller/knowledge');
  await expect(page.getByTestId('seller-knowledge')).toContainText('правила.md');
  // документ, который бот собирает из «Данных объекта», — словами, а не именем файла
  await expect(page.getByTestId('seller-knowledge')).toContainText('Данные объекта (от платформы)');
  await expect(page.getByTestId('seller-knowledge')).not.toContainText('platform:facts.md');
  await page.getByTestId('knowledge-file').setInputFiles({
    name: 'прайс.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Цены\nДвухместный — по тарифу сайта'),
  });
  await page.getByTestId('knowledge-upload').click();
  await expect(page.getByTestId('knowledge-result')).toHaveText('Загружено: «прайс.md», частей 1.');
  await expect(page.getByTestId('seller-knowledge')).toContainText('прайс.md');
});

test('«Диалоги»: пометка «нужен человек», отбор, карточка, перехват и ответ', async ({ page }) => {
  await page.goto('/ai-seller/dialogs');
  const list = page.getByRole('region', { name: 'Диалоги продавца' });
  await expect(list.getByRole('row')).toHaveCount(3);
  await expect(list).toContainText('нужен человек');

  await page.getByRole('navigation', { name: 'Отбор диалогов' }).getByRole('link', { name: 'Нужен человек' }).click();
  await expect(page).toHaveURL(/mode=needs_human/);
  await expect(page.getByRole('region', { name: 'Диалоги продавца' }).getByRole('row')).toHaveCount(2);

  await page.getByRole('link', { name: 'А***' }).click();
  const card = page.getByTestId('seller-dialog-card');
  await expect(card).toContainText('Алия Тестова');
  await expect(card).toContainText('есть двухместный на 1–3 октября');
  // что продавец узнал о госте — словами стойки, без кодов бота; контакт не повторяется
  const lead = page.getByTestId('seller-dialog-lead');
  await expect(lead).toContainText('Что ищет');
  await expect(lead).toContainText('Когда');
  await expect(lead).toContainText('1–3 октября');
  await expect(lead).toContainText('Гостей');
  await expect(lead).not.toContainText('timeframe');
  await expect(lead).not.toContainText('guests');
  await expect(lead).not.toContainText('+7 700');

  await page.getByTestId('dialog-takeover').click();
  await expect(page.getByTestId('dialog-mode-result')).toContainText('Диалог ваш');
  await expect(page.getByTestId('seller-dialog-mode')).toHaveText('ведёт человек');

  await page.getByTestId('dialog-reply-text').fill('Здравствуйте! Двухместный на эти даты свободен.');
  await page.getByTestId('dialog-reply').click();
  await expect(page.getByTestId('dialog-reply-result')).toHaveText('Ответ отправлен.');
  await expect(page.getByTestId('seller-dialog-card')).toContainText('Двухместный на эти даты свободен');
});

test('«Код для сайта»: тег чата продавца и кнопка «Скопировать»', async ({ page }) => {
  await page.goto('/ai-seller/embed');
  await expect(page.getByTestId('seller-embed-snippet')).toHaveText(
    '<script async src="https://seller.example.invalid/widget/widget.js"></script>',
  );
  await expect(page.getByRole('button', { name: 'Скопировать код' })).toBeVisible();
});

test('карточка диалога по неизвестному id не падает, а говорит словами', async ({ page }) => {
  await page.goto(`/ai-seller/dialogs?id=${DIALOG.replace('3f2a', '0000')}`);
  await expect(page.getByTestId('seller-dialog-error')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Диалоги продавца' })).toBeVisible();
});

test('продавец не подключён — раздел говорит об этом, настройки сохраняются заранее (ТЗ §4.4)', async ({
  page,
  request,
}) => {
  await request.post(`${API}/__test/control`, { data: { sellerState: 'not-configured' } });
  await page.goto('/ai-seller');
  await expect(page.getByTestId('seller-state')).toContainText('не подключён');
  await page.getByTestId('seller-apply').click();
  await expect(page.getByTestId('seller-apply-warning')).toContainText('Настройки сохранены');
  for (const [route, title] of [
    ['/ai-seller/knowledge', 'Знания появятся, когда продавец будет подключён'],
    ['/ai-seller/dialogs', 'Диалоги появятся, когда продавец будет подключён'],
    ['/ai-seller/check', 'Проверка заработает, когда продавец будет подключён'],
  ] as const) {
    await page.goto(route);
    await expect(page.getByTestId('seller-not-ready')).toContainText(title);
  }
});

test('продавец недоступен — раздел говорит об этом и обещает повтор', async ({ page, request }) => {
  await request.post(`${API}/__test/control`, {
    data: { sellerLastError: 'ИИ-продавец недоступен (HTTP 502)', sellerRetrying: true },
  });
  await page.goto('/ai-seller');
  const state = page.getByTestId('seller-state');
  await expect(state).toContainText('ИИ-продавец недоступен (HTTP 502)');
  await expect(state).toContainText('Повторяем отправку автоматически раз в минуту');
});

test('продавец отклонил правки — его причина и что делать; повтора не обещаем', async ({ page, request }) => {
  await request.post(`${API}/__test/control`, {
    data: {
      sellerLastError:
        'ИИ-продавец отклонил: В полях найдены инструкции для модели — «Приветствие»',
      sellerRetrying: false,
    },
  });
  await page.goto('/ai-seller');
  const state = page.getByTestId('seller-state');
  await expect(state).toContainText('отклонил правки');
  await expect(state).toContainText('«Приветствие»');
  await expect(state).toContainText('нажмите «Применить»');
  await expect(state).not.toContainText('Повторяем');
});

/** Снимки экранов раздела для отчёта (AGENTS.md §10): светлая тема 1440 и телефон 390 */
test('снимки экранов раздела', async ({ page }) => {
  const dir = 'reports/ai-seller-2026-09-24';
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  // высокое окно вместо склейки страницы: закреплённые меню и шапка на склейке «плывут» посреди снимка
  await page.setViewportSize({ width: 1440, height: 2000 });
  await page.goto('/ai-seller');
  await page.getByLabel('Обращение к гостю').selectOption('INFORMAL');
  await page.getByTestId('seller-faq-add').click();
  await page.getByLabel('Вопрос 1').fill('Есть ли парковка?');
  await page.getByLabel('Ответ 1').fill('Парковки нет, рядом городская.');
  await page.getByTestId('seller-apply').click();
  await expect(page.getByTestId('seller-apply-result')).toBeVisible();
  await page.screenshot({ path: `${dir}/settings-1440.png`, fullPage: false });
  for (const [route, name] of [
    ['/ai-seller/data', 'data'],
    ['/ai-seller/knowledge', 'knowledge'],
    [`/ai-seller/dialogs?id=${DIALOG}`, 'dialogs'],
    ['/ai-seller/embed', 'embed'],
  ] as const) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.screenshot({ path: `${dir}/${name}-1440.png`, fullPage: false });
  }
  await page.goto('/ai-seller/check');
  await page.getByTestId('sandbox-text').fill('Есть места на выходные?');
  await page.getByTestId('sandbox-send').click();
  await expect(page.getByTestId('sandbox-history')).toContainText('тебе');
  await page.screenshot({ path: `${dir}/check-1440.png`, fullPage: false });
  await page.setViewportSize({ width: 390, height: 2400 });
  await page.goto('/ai-seller');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.screenshot({ path: `${dir}/settings-390.png`, fullPage: false });
});
