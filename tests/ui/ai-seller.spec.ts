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
  // пункт меню — у вошедшего, чья организация с расширением (ADR-083; без входа — tests/ui/platform-access.spec.ts)
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
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
    'Модель',
    'WhatsApp',
    'Проверка',
  ]);
  await expect(page.getByTestId('seller-state')).toContainText('Продавец ещё не настроен');
  // «Настройки» — семь шагов; новый продавец открывается на первом (поручение владельца 25.09.2026)
  const steps = page.getByRole('navigation', { name: 'Шаги настройки продавца' }).getByRole('link');
  await expect(steps).toHaveCount(7);
  await expect(steps.first()).toHaveAttribute('aria-current', 'step');
  await expect(page.getByRole('heading', { level: 2, name: 'Знакомство' })).toBeVisible();
});

const next = (page: import('@playwright/test').Page) => page.getByTestId('seller-step-next').click();
// точное имя: на шаге «Цены» есть и заголовок таблицы «Категории и цены…»
const stepHeading = (page: import('@playwright/test').Page, name: string) =>
  expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeVisible();
const stepWord = (page: import('@playwright/test').Page, step: string) =>
  page.getByRole('navigation', { name: 'Шаги настройки продавца' }).getByRole('link', { name: new RegExp(step) });

test('семь шагов по порядку: «вы» → «ты», «Применить» — следующий ответ в «Проверке» на «ты» (ТЗ §4.4)', async ({
  page,
}) => {
  await page.goto('/ai-seller/check');
  await page.getByTestId('sandbox-text').fill('Здравствуйте, есть места?');
  await page.getByTestId('sandbox-send').click();
  await expect(page.getByTestId('sandbox-history')).toContainText('Чем могу вам помочь?');

  await page.goto('/ai-seller');
  await stepHeading(page, 'Знакомство');
  await page.getByLabel('Имя бота').fill('Айгерим');
  await page.getByLabel('Приветствие').fill('Привет! Я Айгерим, помогу выбрать место.');
  await next(page);

  await expect(page).toHaveURL(/step=2/);
  await stepHeading(page, 'Манера');
  await expect(stepWord(page, 'Знакомство')).toContainText('готово');
  // вариант выбирают по звучанию: рядом — пример фразы
  const address = page.getByRole('group', { name: 'Обращение к гостю' });
  await expect(address).toContainText('Привет! Чем могу тебе помочь?');
  await address.getByRole('radio', { name: /на «ты»/ }).check();
  await next(page);

  await expect(page).toHaveURL(/step=3/);
  await stepHeading(page, 'Цены');
  // цены не вводят: продавец называет цену тарифа сайта, шаг показывает какую (ADR-081, Q-179)
  const prices = page.getByRole('region', { name: 'Категории и цены продавца' });
  await expect(prices.getByRole('row', { name: /Двухместный номер/ })).toContainText('15 000 ₸ за ночь за 2 гостей');
  await expect(page.getByRole('link', { name: 'Изменить цены в «Тарифах»' })).toHaveAttribute('href', '/rates');
  await page.getByLabel('Что входит в цену').fill('Бельё и полотенца');
  await next(page);

  await expect(page).toHaveURL(/step=4/);
  await stepHeading(page, 'Правила');
  await page.getByLabel('Запреты — по одному в строке').fill('Не курить в номерах');
  await next(page);

  await expect(page).toHaveURL(/step=5/);
  await stepHeading(page, 'Частые вопросы');
  // подсказка добавляет строку с вопросом — ответ пишет владелец
  await page.getByRole('group', { name: 'Частые вопросы гостей' }).getByRole('button', { name: 'Есть ли парковка?' }).click();
  await expect(page.getByLabel('Вопрос 1')).toHaveValue('Есть ли парковка?');
  await page.getByLabel('Ответ 1').fill('Парковки нет, рядом городская.');
  await next(page);

  await expect(page).toHaveURL(/step=6/);
  await stepHeading(page, 'Документы');
  await expect(page.getByTestId('seller-knowledge')).toContainText('правила.md');
  await next(page);

  await expect(page).toHaveURL(/step=7/);
  await stepHeading(page, 'Запуск');
  const briefing = page.getByTestId('seller-briefing');
  await expect(briefing).toContainText('«Айгерим»');
  await expect(briefing).toContainText('на «ты»');
  await expect(briefing).toContainText('Бельё и полотенца');
  await expect(briefing).toContainText('1 готовый ответ');
  await expect(page.getByTestId('seller-setup-missing')).toHaveCount(0);
  await page.getByTestId('seller-apply').click();
  await expect(page.getByTestId('seller-apply-result')).toHaveText(
    'Применено: продавец получил настройки и данные объекта.',
  );
  await expect(page.getByTestId('seller-state')).toContainText('Продавец работает с текущими настройками');
  await expect(stepWord(page, 'Запуск')).toContainText('отправлено');

  await page.getByRole('link', { name: 'Поговорить с продавцом' }).click();
  await page.getByTestId('sandbox-text').fill('Есть места на выходные?');
  await page.getByTestId('sandbox-send').click();
  await expect(page.getByTestId('sandbox-history')).toContainText('Чем могу тебе помочь?');
});

test('«Назад» сохраняет введённое; эмодзи — из трёх вариантов бота, запреты — по одному в строке (ADR-081)', async ({
  page,
}) => {
  await page.goto('/ai-seller?step=2');
  const emoji = page.getByRole('group', { name: 'Эмодзи' }).getByRole('radio');
  await expect(emoji).toHaveCount(3);
  await expect(page.getByRole('group', { name: 'Эмодзи' })).toContainText('только в приветствии');
  await expect(page.getByRole('group', { name: 'Длина ответов' }).getByRole('radio')).toHaveCount(2);
  await page.getByRole('radio', { name: /только в приветствии/ }).check();
  await page.getByTestId('seller-step-back').click();
  await expect(page).toHaveURL(/step=1/);
  await page.goto('/ai-seller?step=2');
  await expect(page.getByRole('radio', { name: /только в приветствии/ })).toBeChecked();

  await page.goto('/ai-seller?step=4');
  await page.getByLabel('Запреты — по одному в строке').fill('Не курить в номерах\n\nБез животных');
  await page.getByLabel('Когда звать человека — по одному в строке').fill('Группа от 6 человек');
  await next(page);
  await expect(page).toHaveURL(/step=5/);
  await page.goto('/ai-seller?step=4');
  // пустая строка — не правило: у продавца список из двух запретов
  await expect(page.getByLabel('Запреты — по одному в строке')).toHaveValue('Не курить в номерах\nБез животных');
  await expect(page.getByLabel('Когда звать человека — по одному в строке')).toHaveValue('Группа от 6 человек');
  await expect(stepWord(page, 'Правила')).toContainText('готово');
});

test('без языков шаг отказывает словами домена и остаётся открытым, введённое не пропадает', async ({ page }) => {
  await page.goto('/ai-seller?step=1');
  await page.getByLabel('Имя бота').fill('Айгерим');
  await page.getByRole('checkbox', { name: 'Русский' }).uncheck();
  await next(page);
  await expect(page.getByTestId('seller-step-error')).toHaveText('Языки: нужен хотя бы один');
  await expect(page.getByLabel('Имя бота')).toHaveValue('Айгерим');
  await stepHeading(page, 'Знакомство');
});

test('«Запуск» называет незаполненные шаги и не прячет правила ядра', async ({ page }) => {
  await page.goto('/ai-seller?step=7');
  await expect(page.getByTestId('seller-setup-missing')).toContainText('«Знакомство»');
  await expect(page.getByTestId('seller-briefing')).toContainText('без имени — от лица гостиницы');
  await expect(page.getByTestId('seller-briefing')).toContainText(
    'всегда — жалоба, возврат денег, изменение или отмена брони',
  );
  await expect(page.getByTestId('seller-briefing-facts')).toContainText('заезд с 14:00');
});

test('«Данные объекта» — только просмотр: факты, цены по категориям, куда идти править', async ({ page }) => {
  await page.goto('/ai-seller/data');
  const facts = page.getByTestId('seller-facts');
  await expect(facts).toContainText('Алматы, ул. Тестовая, 1');
  await expect(facts).toContainText('14:00');
  const table = page.getByRole('region', { name: 'Категории и цены продавца' });
  await expect(table).toContainText('Двухместный номер');
  // одна цена весь срок — её продавец и называет; меняется — «уточнит администратор» (ADR-081, Q-179)
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

test('«Код для сайта»: тег с ключом гостиницы, домены её сайта, кнопка «Скопировать» (Э4)', async ({
  page,
  request,
}) => {
  await page.goto('/ai-seller/embed');
  await expect(page.getByTestId('seller-embed-snippet')).toHaveText(
    `<script async src="https://seller.example.invalid/widget/widget.js" data-key="sk_${'a1'.repeat(12)}"></script>`,
  );
  await expect(page.getByTestId('seller-embed-hosts')).toContainText('hotel-a.example.invalid');
  await expect(page.getByRole('button', { name: 'Скопировать код' })).toBeVisible();

  // сайта у гостиницы нет — экран говорит завести его, а не молчит (план Э4 §1)
  await request.post(`${API}/__test/control`, { data: { sellerHosts: [] } });
  await page.reload();
  await expect(page.getByTestId('seller-embed-no-site')).toContainText('Настройках сайта');
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
  await expect(stepWord(page, 'Документы')).toContainText('после подключения');
  await page.getByLabel('Приветствие').fill('Здравствуйте!');
  await next(page);
  await expect(page).toHaveURL(/step=2/);
  await page.goto('/ai-seller?step=6');
  await expect(page.getByTestId('seller-docs-later')).toBeVisible();
  await page.goto('/ai-seller?step=7');
  await page.getByTestId('seller-apply').click();
  await expect(page.getByTestId('seller-apply-warning')).toContainText(
    'Настройки сохранены. Продавец ещё не подключён',
  );
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

/** Снимки экранов раздела для отчёта (AGENTS.md §10): шаги настройки — светлая тема 1440 и телефон 390 */
test('снимки экранов раздела', async ({ page }) => {
  const dir = 'reports/ai-seller-setup-2026-09-25';
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  // высокое окно вместо склейки страницы: закреплённые меню и шапка на склейке «плывут» посреди снимка
  await page.setViewportSize({ width: 1440, height: 1500 });
  await page.goto('/ai-seller');
  await page.getByLabel('Имя бота').fill('Айгерим');
  await page.getByLabel('Приветствие').fill('Привет! Я Айгерим, помогу выбрать место.');
  await page.screenshot({ path: `${dir}/step-1-1440.png`, fullPage: false });
  await next(page);
  await expect(page).toHaveURL(/step=2/);
  await page.screenshot({ path: `${dir}/step-2-1440.png`, fullPage: false });
  await page.getByRole('radio', { name: /на «ты»/ }).check();
  await next(page);
  await expect(page).toHaveURL(/step=3/);
  await page.getByLabel('Что входит в цену').fill('Бельё и полотенца');
  await page.screenshot({ path: `${dir}/step-3-1440.png`, fullPage: false });
  await page.goto('/ai-seller?step=5');
  await page.getByRole('group', { name: 'Частые вопросы гостей' }).getByRole('button', { name: 'Есть ли парковка?' }).click();
  await page.getByLabel('Ответ 1').fill('Парковки нет, рядом городская.');
  await page.screenshot({ path: `${dir}/step-5-1440.png`, fullPage: false });
  await next(page);
  await page.goto('/ai-seller?step=7');
  await expect(page.getByTestId('seller-briefing')).toBeVisible();
  await page.screenshot({ path: `${dir}/step-7-1440.png`, fullPage: false });
  await page.setViewportSize({ width: 390, height: 1800 });
  await page.goto('/ai-seller?step=1');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.screenshot({ path: `${dir}/step-1-390.png`, fullPage: false });
  await page.goto('/ai-seller?step=2');
  await expect(page.getByRole('heading', { level: 2, name: 'Манера' })).toBeVisible();
  await page.screenshot({ path: `${dir}/step-2-390.png`, fullPage: false });
});

test('окно рассказа (С1): «Создать» раскладывает рассказ по пустым полям, адрес и цены — только сверить', async ({
  page,
}) => {
  await page.goto('/ai-seller');
  const story = page.getByTestId('seller-story');
  await expect(story).toBeVisible();
  // голос — по желанию: кнопка на месте, аудио на сервер не уходит (распознаёт браузер)
  await expect(page.getByTestId('seller-story-mic')).toHaveText('Говорить голосом');
  await page
    .getByTestId('seller-story-text')
    .fill('У нас хостел «Тёплый» в Алматы, улица Вымышленная, 1. Койка — 8000 тенге, заезд с 14:00.');
  await page.getByTestId('seller-story-send').click();
  const result = page.getByTestId('seller-story-result');
  await expect(result).toContainText('Имя бота');
  await expect(result).toContainText('Проверьте шаги ниже');
  // адрес и цены из рассказа никуда не записаны — блок «сверьте» с ценой словами
  const aside = page.getByTestId('seller-story-aside');
  await expect(aside).toContainText('Алматы, ул. Вымышленная, 1');
  await expect(aside).toContainText('8 000');
  await expect(aside).toContainText('сверьте с «Данными объекта» и «Тарифами»');
  // извлечённое легло в черновик: шаг «Знакомство» показывает имя (мастер сам открылся бы на незаполненном)
  await page.goto('/ai-seller?step=1');
  await expect(page.getByLabel('Имя бота')).toHaveValue('Айсулу');
});

test('окно рассказа: занятые руками поля не затираются, слишком короткий рассказ — отказ словами', async ({
  page,
}) => {
  // сначала рука: имя бота на шаге «Знакомство»
  await page.goto('/ai-seller?step=1');
  await page.getByLabel('Имя бота').fill('Дана');
  await page.getByTestId('seller-step-next').click();
  await expect(page.getByRole('heading', { level: 2, name: 'Манера', exact: true })).toBeVisible();
  await page.goto('/ai-seller');
  await page.getByTestId('seller-story').locator('summary').click();
  await page
    .getByTestId('seller-story-text')
    .fill('Хостел «Тёплый» в Алматы, койка 8000 тенге, бельё и Wi-Fi в цене.');
  await page.getByTestId('seller-story-send').click();
  const result = page.getByTestId('seller-story-result');
  await expect(result).toContainText('Уже заполнено раньше и не тронуто: Имя бота');
  await page.goto('/ai-seller?step=1');
  await expect(page.getByLabel('Имя бота')).toHaveValue('Дана');
});

test('окно «Модель» (С2): проверить, сохранить (видны только последние 4 знака), снять', async ({ page }) => {
  await page.goto('/ai-seller/model');
  await expect(page.getByTestId('seller-llm-key-state')).toContainText('Ключ не задан');
  // «Проверить» — живой вызов роутера у бота: чужой ключ он не принимает
  await page.getByTestId('seller-llm-key-input').fill('sk-bad-key-123456');
  await page.getByTestId('seller-llm-key-check').click();
  await expect(page.getByTestId('seller-llm-key-error')).toContainText('Роутер не принял ключ');
  // действительный — сохраняется; наружу — только последние 4 знака
  await page.getByTestId('seller-llm-key-input').fill('sk-valid-key-7890');
  await page.getByTestId('seller-llm-key-check').click();
  await expect(page.getByTestId('seller-llm-key-message')).toContainText('Ключ действителен');
  await page.getByTestId('seller-llm-key-input').fill('sk-valid-key-7890');
  await page.getByTestId('seller-llm-key-save').click();
  await expect(page.getByTestId('seller-llm-key-message')).toContainText('оканчивается на 7890');
  await expect(page.getByTestId('seller-llm-key-state')).toContainText('····7890');
  await expect(page.locator('body')).not.toContainText('sk-valid-key-7890');
  // «Снять ключ» возвращает ход на ключ платформы
  await page.getByTestId('seller-llm-key-clear').click();
  await expect(page.getByTestId('seller-llm-key-cleared')).toContainText('Ключ снят');
  await expect(page.getByTestId('seller-llm-key-state')).toContainText('Ключ не задан');
});

test('окно «WhatsApp» (С3): проверить, подключить — адрес и слово для консоли Meta, отключить', async ({
  page,
}) => {
  await page.goto('/ai-seller/whatsapp');
  await expect(page.getByTestId('seller-whatsapp-state')).toContainText('не подключён');
  await page.getByTestId('seller-whatsapp-phone-id').fill('555000111');
  await page.getByTestId('seller-whatsapp-token').fill('EAAG-bad-token-16chars');
  await page.getByTestId('seller-whatsapp-check').click();
  await expect(page.getByTestId('seller-whatsapp-error')).toContainText('Meta не приняла номер или токен');
  // после действия форма сбрасывается — заполняем оба поля заново
  await page.getByTestId('seller-whatsapp-phone-id').fill('555000111');
  await page.getByTestId('seller-whatsapp-token').fill('EAAG-valid-token-16chars');
  await page.getByTestId('seller-whatsapp-check').click();
  await expect(page.getByTestId('seller-whatsapp-message')).toContainText('Номер подтверждён');
  await page.getByTestId('seller-whatsapp-phone-id').fill('555000111');
  await page.getByTestId('seller-whatsapp-token').fill('EAAG-valid-token-16chars');
  await page.getByTestId('seller-whatsapp-secret').fill('meta-app-secret');
  await page.getByTestId('seller-whatsapp-save').click();
  await expect(page.getByTestId('seller-whatsapp-state')).toContainText('555000111');
  // партнёру — что вписать в консоль Meta; токен на экран не возвращается
  const meta = page.getByTestId('seller-whatsapp-meta');
  await expect(meta).toContainText('/channels/whatsapp/webhook/');
  await expect(meta).toContainText('slovo-dlya-meta-ui');
  await expect(page.locator('body')).not.toContainText('EAAG-valid-token-16chars');
  await page.getByTestId('seller-whatsapp-disconnect').click();
  await expect(page.getByTestId('seller-whatsapp-state')).toContainText('не подключён');
});
