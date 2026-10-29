import { mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { APIRequestContext } from '@playwright/test';
import { FIXTURE_API, expect, test, devNoise, type Page } from './fixtures';

/**
 * «Маркетинг → Бюджет» (МКТ-В1/В2, ТЗ «Модуль Маркетинг» 1.0 от 09.10.2026, ADR-MKT-B1):
 * карточка на хабе, обзор месяца (план, израсходовано, остаток, прогноз, распределение),
 * журнал расходов с фильтром и правкой, панель «Новый расход» с чужой валютой и курсом,
 * аналитика с честным «Недостаточно данных» у CPL/ROMI. Подставной API считает тем же
 * доменом, что настоящий. Данные вымышленные (ADR-010).
 */
const API = FIXTURE_API;
const SHOTS = 'reports/marketing-budget-2026-10-09';

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

const monthShift = (month: string, shift: number) => {
  const [y, m] = month.split('-').map(Number);
  const total = (y as number) * 12 + ((m as number) - 1) + shift;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
};

/** Месяц с расходами по трём каналам (один в долларах по курсу на дату), план и прошлый месяц */
async function seed(
  request: APIRequestContext,
  /** МКТ-В5a: результаты каналов месяца тем же засевом (засев каждый раз всё сбрасывает); `today` стенда */
  results?: (today: string) => Record<string, unknown>,
): Promise<{ today: string; month: string }> {
  const reset = await request.post(`${API}/__test/marketing-budget`, { data: {} });
  const { today } = (await reset.json()) as { today: string };
  const month = today.slice(0, 7);
  const prev = `${monthShift(month, -1)}-15`;
  await request.post(`${API}/__test/marketing-budget`, {
    data: {
      ...(results ? { results: { month, ...results(today) } } : {}),
      plan: { month, amount: '3000' },
      expenses: [
        { date: today, platform: 'META', campaign: 'Лиды: Клиника', category: 'Реклама', amount: '720' },
        { date: today, platform: 'GOOGLE', category: 'Реклама', amount: '480' },
        { date: today, platform: 'TIKTOK', category: 'Креативы', amount: '100', currency: 'USD', fxRate: '500' },
        { date: today, platform: 'INSTAGRAM', category: 'Реклама', amount: '120', countedInBudget: false },
        { date: prev, platform: 'META', category: 'Реклама', amount: '600' },
      ],
    },
  });
  return { today, month };
}

/** Вкладка «План» раздела «Бюджет и аналитика» (до 20.10.2026 обзор на `/marketing/budget`) */
async function openBudget(page: Page) {
  await page.goto('/marketing/budget/plan');
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText('Бюджет и аналитика');
}

test('хаб: карточка «Бюджет и аналитика» живая и ведёт в сводку; пустой месяц честный', async ({ page }) => {
  await page.goto('/marketing');
  const card = page.getByTestId('marketing-budget');
  await expect(card.getByTestId('marketing-budget-status')).toHaveText('В работе');
  await card.getByTestId('marketing-budget-page').click();
  await page.waitForURL('**/marketing/budget');
  const main = page.getByRole('main');
  await expect(main.getByTestId('budget-summary')).toBeVisible();
  await expect(main.getByTestId('summary-channels-empty')).toBeVisible();
  // вкладки раздела и переключатель месяца на месте
  const tabs = main.getByRole('navigation', { name: 'Разделы бюджета и аналитики' });
  await expect(tabs.getByRole('link')).toHaveText(['Сводка', 'План', 'Расходы', 'Аналитика']);
  await expect(main.getByTestId('budget-month-name')).not.toHaveText('');
  await tabs.getByRole('link', { name: 'План' }).click();
  await page.waitForURL('**/marketing/budget/plan?month=*');
  await expect(main.getByTestId('budget-plan')).toHaveText('Не задан');
  await expect(main.getByTestId('budget-recent-empty')).toContainText('расходов ещё нет');
});

test('первый расход и план месяца: суммы, остаток, прогноз и распределение оживают', async ({ page }) => {
  await openBudget(page);
  const main = page.getByRole('main');

  // отказ словами: статья из одних пробелов проходит браузерное required, но её режет сервер
  await main.getByTestId('budget-add').click();
  const form = page.getByTestId('budget-expense-form');
  await form.getByTestId('budget-amount').fill('720');
  await form.getByTestId('budget-category').fill('   ');
  await form.getByTestId('budget-save').click();
  await expect(form.getByRole('alert')).toContainText('Статья');
  await expect(form.getByTestId('budget-amount')).toHaveValue('720');

  await form.getByTestId('budget-category').fill('Реклама');
  await form.getByTestId('budget-save').click();
  await expect(page.getByText('Расход добавлен')).toBeVisible();
  await expect(main.getByTestId('budget-spent')).toContainText('720');

  // план месяца: остаток и рекомендация появляются
  await main.getByTestId('budget-plan-edit').click();
  const plan = page.getByTestId('budget-plan-form');
  await plan.getByTestId('budget-plan-amount').fill('3000');
  await plan.getByTestId('budget-plan-save').click();
  await expect(page.getByText('План месяца сохранён')).toBeVisible();
  await expect(main.getByTestId('budget-plan')).toContainText('3 000');
  await expect(main.getByTestId('budget-remainder')).toContainText('2 280');
  await expect(main.getByTestId('budget-ontrack')).toBeVisible();
  await expect(main.getByTestId('budget-shares')).toContainText('Meta Ads');
});

test('журнал: чужая валюта по курсу, фильтр чипами, правка и удаление', async ({ page, request }) => {
  const { month } = await seed(request);
  await page.goto(`/marketing/budget/expenses?month=${month}`);
  const main = page.getByRole('main');
  const table = main.getByTestId('budget-table');
  // 4 строки текущего месяца (прошлый месяц не в окне)
  await expect(table.locator('tbody tr')).toHaveCount(4);
  // доллары пересчитаны на дату операции: 100 USD × 500 = 50 000, курс подписан
  const usd = table.getByRole('row', { name: /TikTok/ });
  await expect(usd).toContainText('100 USD');
  await expect(usd).toContainText('курс 500');
  await expect(usd).toContainText('50 000');
  // расход вне бюджета подписан
  await expect(table.getByRole('row', { name: /Instagram/ })).toContainText('Вне бюджета');

  // фильтр чипом: остаётся одна строка, итог пересчитан
  await main.getByRole('navigation', { name: 'Фильтр по платформе' }).getByRole('link', { name: 'Meta Ads' }).click();
  await page.waitForURL('**platform=META');
  await expect(main.getByTestId('budget-table').locator('tbody tr')).toHaveCount(1);
  await expect(main.getByTestId('budget-filter-sum')).toContainText('1 расход на 720 ₸');

  // правка: сумма меняется, журнал пересчитывается
  await main.getByTestId('budget-table').getByRole('button', { name: /Изменить расход: Meta Ads/ }).click();
  const form = page.getByTestId('budget-expense-form');
  await form.getByTestId('budget-amount').fill('800');
  await form.getByTestId('budget-save').click();
  await expect(page.getByText('Расход сохранён')).toBeVisible();
  await expect(main.getByTestId('budget-filter-sum')).toContainText('800 ₸');

  // удаление: с подтверждением словами, строка уходит
  await main.getByTestId('budget-table').getByRole('button', { name: /Изменить расход: Meta Ads/ }).click();
  await page.getByTestId('budget-delete').click();
  await page.getByRole('button', { name: 'Удалить', exact: true }).click();
  await expect(page.getByText('Расход удалён', { exact: false })).toBeVisible();
  await expect(main.getByTestId('budget-empty')).toBeVisible();
});

test('аналитика маркетинга: воронка, CPL, стоимость брони и ROMI из результатов каналов; реклама без кабинетов только расход', async ({
  page,
  request,
}) => {
  // результаты каналов месяца (МКТ-В5a): сайт и WhatsApp с бронями, реклама Meta/Google/TikTok без своих результатов
  const { month, today } = await seed(request, (day) => ({
    channels: [
      { channel: 'SITE', leads: 6, bookings: 2, revenue: '500000' },
      { channel: 'WHATSAPP', leads: 4, bookings: 2, revenue: '550000' },
      { channel: 'INSTAGRAM', leads: 0, bookings: 0, revenue: '0' },
      { channel: 'PHONE', leads: 0, bookings: 0, revenue: '0' },
    ],
    // те же результаты одним днём: сумма дней равна месяцу
    days: [{ date: day, leads: 10, bookings: 4, newGuests: 3, revenue: '1050000' }],
  }));
  // прежний адрес аналитики бюджета живёт перенаправлением, месяц сохраняется
  await page.goto(`/marketing/budget/analytics?month=${month}`);
  await page.waitForURL(`**/marketing/analytics?month=${month}`);
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Бюджет и аналитика');
  await expect(
    main.getByRole('navigation', { name: 'Разделы бюджета и аналитики' }).getByRole('link', { name: 'Аналитика' }),
  ).toHaveAttribute('aria-current', 'page');
  // учтено 720 + 480 + 50 000 = 51 200 ₸; прошлый месяц 600 → рост
  await expect(main.getByTestId('man-spent')).toContainText('51 200');
  await expect(main.getByText('к прошлому месяцу')).toBeVisible();
  // обращения 10, брони 4 (40 % обращений), выручка 10 500 ₸
  await expect(main.getByTestId('man-leads')).toHaveText('10');
  await expect(main.getByTestId('man-bookings')).toHaveText('4');
  await expect(main.getByText('40 % обращений')).toBeVisible();
  await expect(main.getByTestId('man-revenue')).toContainText('10 500');
  // CPL 51 200 / 10 = 5 120 ₸; стоимость брони 51 200 / 4 = 12 800 ₸; ROMI (10 500 − 51 200) / 51 200 = −79 %
  await expect(main.getByTestId('man-cpl')).toContainText('5 120');
  await expect(main.getByTestId('man-cpb')).toContainText('12 800');
  await expect(main.getByTestId('man-romi')).toHaveText('-79 %');
  // квалификацию не имитируем
  await expect(main.getByText('Недостаточно данных')).toHaveCount(1);
  await expect(main.getByTestId('man-funnel')).toBeVisible();

  const table = main.getByTestId('man-sources');
  // сначала каналы с результатом, затем реклама по расходу
  const site = table.getByRole('row', { name: /^Сайт/ });
  await expect(site).toContainText('6');
  await expect(site).toContainText('5 000');
  const wa = table.getByRole('row', { name: /^WhatsApp/ });
  await expect(wa).toContainText('5 500');
  // TikTok: только расход, результаты прочерком и подпись, куда ведёт реклама
  const tiktok = table.getByRole('row', { name: /TikTok Ads/ });
  await expect(tiktok).toContainText('50 000');
  await expect(tiktok).toContainText('ведёт на сайт и в мессенджеры');
  await expect(main.getByTestId('man-total')).toContainText('51 200');
  await expect(main.getByTestId('man-sources-note')).toContainText('Канал брони это её источник');
  // календарь маркетинга: строка сегодняшнего дня и итог; дни месяца до сегодня включительно
  const calendar = main.getByTestId('man-calendar');
  await expect(calendar.locator('tbody tr')).toHaveCount(Number(today.slice(8, 10)));
  const todayRow = main.getByTestId(`man-day-${today}`);
  // расход 51 200 ₸, лиды 10, CPL 5 120 ₸, брони 4, новые клиенты 3, выручка 10 500 ₸, ROMI −79 %
  for (const text of ['51 200', '10', '5 120', '4', '3', '10 500', '-79 %'])
    await expect(todayRow).toContainText(text);
  await expect(main.getByTestId('man-calendar-total')).toContainText('10 500');
  await expect(main.getByTestId('man-calendar-note')).toContainText('Новые клиенты');
  await expect(main.getByTestId('budget-chart')).toBeVisible();

  // выгрузка в CSV (МКТ-В6): те же числа, что на экране, деньги с запятой для Excel
  const [download] = await Promise.all([page.waitForEvent('download'), main.getByTestId('man-export').click()]);
  expect(download.suggestedFilename()).toBe(`wetop-marketing-${month}.csv`);
  const csv = (await readFile(await download.path(), 'utf8')).replace(/^\uFEFF/, '').split('\r\n');
  expect(csv).toContain('Итого;51200,00;10;5120,00;4;12800,00;10500,00;-79');
  expect(csv).toContain(`${today};51200,00;10;5120,00;4;3;10500,00;-79`);
  expect(csv).toContain('Сайт;0,00;6;;2;;5000,00;');
});

test('аналитика у филиала без броней гостиницы: только расходы и честное «Скоро»', async ({
  page,
  request,
}) => {
  const { month } = await seed(request, () => ({ supported: false }));
  await page.goto(`/marketing/analytics?month=${month}`);
  const main = page.getByRole('main');
  await expect(main.getByTestId('man-results-soon')).toContainText('салона и ресторана');
  await expect(main.getByTestId('man-leads')).toHaveText('–');
  await expect(main.getByTestId('man-funnel')).toHaveCount(0);
  await expect(main.getByTestId('man-spent')).toContainText('51 200');
  // выручки нет, а не ноль: ROMI прочерком, не «−100 %» (аудит платформы 17.10.2026, Д7)
  await expect(main.getByTestId('man-romi')).toContainText('–');
  await expect(main.getByTestId('man-romi')).not.toContainText('%');
});

test('переключатель месяца: прошлый месяц показывает свои расходы и прогноз равен факту', async ({
  page,
  request,
}) => {
  await seed(request);
  await openBudget(page);
  const main = page.getByRole('main');
  await main.getByTestId('budget-month-prev').click();
  await page.waitForURL('**month=*');
  await expect(main.getByTestId('budget-spent')).toContainText('600');
  await expect(main.getByTestId('budget-forecast')).toContainText('600');
});

test('план по каналам: разбивка прошлого месяца, копирование, превышение общего плана предупреждает, план против факта', async ({
  page,
  request,
}) => {
  const { month } = await seed(request);
  const prev = monthShift(month, -1);
  const main = page.getByRole('main');

  // прошлый месяц без общего плана: сумма каналов и есть план месяца
  await page.goto(`/marketing/budget/plan?month=${prev}`);
  await expect(main.getByTestId('budget-lines-empty')).toBeVisible();
  await main.getByTestId('budget-lines-edit').click();
  let form = page.getByTestId('budget-lines-form');
  await form.getByTestId('budget-line-META').fill('500');
  await expect(form.getByTestId('budget-lines-allocated')).toContainText('Сумма каналов: 500 ₸');
  await form.getByTestId('budget-lines-save').click();
  await expect(page.getByText('План по каналам сохранён')).toBeVisible();
  await expect(main.getByTestId('budget-lines-summary')).toContainText('План месяца это сумма каналов: 500 ₸');
  await expect(main.getByTestId('budget-plan')).toContainText('500 ₸');

  // текущий месяц (общий план 3 000 ₸): взять из прошлого, дописать, превысить план
  await page.goto(`/marketing/budget/plan?month=${month}`);
  await main.getByTestId('budget-lines-edit').click();
  form = page.getByTestId('budget-lines-form');
  await form.getByTestId('budget-lines-copy').click();
  await expect(form.getByTestId('budget-line-META')).toHaveValue('500');
  await form.getByTestId('budget-line-GOOGLE').fill('400');
  await form.getByTestId('budget-line-SITE').fill('2 500');
  await expect(form.getByTestId('budget-lines-allocated')).toContainText('Распределено 3 400 ₸ из 3 000 ₸');
  await expect(form.getByTestId('budget-lines-over')).toContainText('больше общего плана на 400 ₸');
  await page
    .locator('.ui-overlay')
    .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))
    .catch(() => undefined);
  let audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(audit.violations).toEqual([]);
  await form.getByTestId('budget-lines-save').click();
  await expect(page.getByText('План по каналам сохранён')).toBeVisible();

  await expect(main.getByTestId('budget-lines-summary')).toContainText('Распределено 3 400 ₸ из 3 000 ₸');
  await expect(main.getByTestId('budget-lines-over')).toContainText('Каналы больше плана на 400 ₸');
  const table = main.getByTestId('budget-lines');
  // каналы с планом по убыванию плана, затем расход без плана
  await expect(table.locator('tbody tr td:first-child .budget-cell-main')).toHaveText([
    'Сайт',
    'Meta Ads',
    'Google Ads',
    'TikTok Ads',
  ]);
  const meta = table.getByRole('row', { name: /Meta Ads/ });
  await expect(meta).toContainText('720 ₸'); // факт больше плана 500: остаток в минусе
  await expect(meta.locator('.budget-td-danger')).toContainText('220');
  await expect(meta).toContainText('Прогноз выше плана');
  await expect(table.getByRole('row', { name: /TikTok Ads/ })).toContainText('без плана');
  audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(audit.violations).toEqual([]);
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/channel-plan-light-1440.png`, fullPage: true });
});

test('чеки расхода: приложить PDF, чужой формат отказ словами, счётчик в журнале, удаление с подтверждением', async ({
  page,
  request,
}) => {
  const { month } = await seed(request);
  await page.goto(`/marketing/budget/expenses?month=${month}`);
  const main = page.getByRole('main');

  // новый расход: чек прикладывают после сохранения
  await main.getByTestId('budget-add').first().click();
  await expect(page.getByTestId('budget-files-later')).toBeVisible();
  await page.keyboard.press('Escape');

  await main.getByTestId('budget-table').getByRole('button', { name: /Изменить расход: Meta Ads/ }).click();
  const files = page.getByTestId('budget-files');
  await expect(files).toContainText('Чеков пока нет');
  await files.getByTestId('budget-file-input').setInputFiles({
    name: 'svg.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
  });
  await files.getByTestId('budget-file-upload').click();
  await expect(files.getByRole('alert')).toContainText('фото (JPEG, PNG, WebP) или PDF');

  await files.getByTestId('budget-file-input').setInputFiles({
    name: 'schet-meta.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n%%EOF\n'),
  });
  await files.getByTestId('budget-file-upload').click();
  await expect(page.getByText('Файл приложен к расходу')).toBeVisible();
  // панель остаётся открытой: файлы прикладывают подряд
  await expect(files.getByTestId('budget-files-list')).toContainText('schet-meta.pdf');
  await page
    .locator('.ui-overlay')
    .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))
    .catch(() => undefined);
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(audit.violations).toEqual([]);
  await page.keyboard.press('Escape');

  const metaRow = main.getByTestId('budget-table').getByRole('row', { name: /Meta Ads/ });
  await expect(metaRow).toContainText('1 файл');

  await main.getByTestId('budget-table').getByRole('button', { name: /Изменить расход: Meta Ads/ }).click();
  await page.getByRole('button', { name: 'Удалить файл schet-meta.pdf' }).click();
  await page.getByRole('button', { name: 'Удалить', exact: true }).click();
  await expect(page.getByText('Файл удалён', { exact: false })).toBeVisible();
  await expect(page.getByTestId('budget-files')).toContainText('Чеков пока нет');
});

/** Кириллица в windows-1251, как сохраняет CSV Excel на Windows: А–я подряд с 0xC0, «ё» и «Ё» отдельно */
const cp1251 = (text: string) =>
  Buffer.from(
    [...text].map((c) => {
      const code = c.charCodeAt(0);
      if (code >= 0x410 && code <= 0x44f) return code - 0x350;
      if (c === 'ё') return 0xb8;
      if (c === 'Ё') return 0xa8;
      if (code > 0x7f) throw new Error(`нет в windows-1251: ${c}`);
      return code;
    }),
  );

test('импорт CSV: файл с ошибкой отклоняется целиком со списком строк, исправленный из Excel загружается', async ({
  page,
  request,
}) => {
  const { month } = await seed(request);
  const [y, m] = month.split('-');
  await page.goto(`/marketing/budget/expenses?month=${month}`);
  const main = page.getByRole('main');
  await expect(main.getByTestId('budget-table').locator('tbody tr')).toHaveCount(4);

  await main.getByTestId('budget-import').click();
  const form = page.getByTestId('budget-import-form');
  await expect(form).toBeVisible();
  await page
    .locator('.ui-overlay')
    .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))
    .catch(() => undefined);
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(audit.violations).toEqual([]);

  const head = 'Дата;Платформа;Кампания;Статья;Сумма';
  const bad = [head, `${month}-05;Meta Ads;Осень;Реклама;1000`, `${month}-06;Яндекс;;Реклама;500`, `${month}-07;Сайт;;Реклама;0`].join('\r\n');
  await form.getByTestId('budget-import-file').setInputFiles({ name: 'bad.csv', mimeType: 'text/csv', buffer: Buffer.from('\uFEFF' + bad) });
  await form.getByTestId('budget-import-save').click();
  const error = form.getByTestId('budget-import-error');
  await expect(error).toContainText('ничего не записано');
  await expect(error).toContainText('Строка 3: Платформа');
  await expect(error).toContainText('Строка 4: Сумма');
  await expect(error).not.toContainText('Строка 2');
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/import-error-light-1440.png` });

  // исправленный файл, пересохранённый Excel: windows-1251, дата ДД.ММ.ГГГГ, пробел в тысячах
  const good = [head, `05.${m}.${y};Meta Ads;Осень;Реклама;1 000`, `06.${m}.${y};Google Ads;;Реклама;500`].join('\r\n');
  await form.getByTestId('budget-import-file').setInputFiles({ name: 'good.csv', mimeType: 'text/csv', buffer: cp1251(good) });
  await form.getByTestId('budget-import-save').click();
  await expect(page.getByText('Загружено 2 расхода на 1 500 ₸')).toBeVisible();
  await expect(form).toBeHidden();
  const table = main.getByTestId('budget-table');
  await expect(table.locator('tbody tr')).toHaveCount(6);
  // в засеве уже есть Google Ads: импорт добавил вторую строку, а не заменил первую
  await expect(table.getByRole('row', { name: /Google Ads/ })).toHaveCount(2);
  await expect(table.getByRole('row', { name: /Осень/ })).toContainText('1 000');
});

for (const theme of ['light', 'dark'] as const) {
  test(`снимки и доступность: ${theme}`, async ({ page, request }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      if (!devNoise.test(error.message)) errors.push(error.message);
    });
    mkdirSync(SHOTS, { recursive: true });
    const axe = async () => {
      const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(audit.violations).toEqual([]);
    };
    const shot = async (name: string) => {
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await page.screenshot({ path: `${SHOTS}/${name}-${theme}-${width}.png`, fullPage: true });
      }
      await page.setViewportSize({ width: 1440, height: 900 });
    };

    // снимки показывают живую воронку: результаты сайта и WhatsApp за месяц
    const { month } = await seed(request, (day) => ({
      channels: [
        { channel: 'SITE', leads: 6, bookings: 2, revenue: '500000' },
        { channel: 'WHATSAPP', leads: 4, bookings: 2, revenue: '550000' },
      ],
      days: [{ date: day, leads: 10, bookings: 4, newGuests: 3, revenue: '1050000' }],
    }));
    await page.goto(`/marketing/budget/plan?month=${month}`);
    await expect(page.getByTestId('budget-shares')).toBeVisible();
    await axe();
    await shot('overview');

    await page.goto(`/marketing/budget/expenses?month=${month}`);
    await expect(page.getByTestId('budget-table')).toBeVisible();
    await axe();
    await shot('expenses');

    await page.getByTestId('budget-add').click();
    await expect(page.getByTestId('budget-expense-form')).toBeVisible();
    // панель выезжает анимацией: axe мерит контраст после её конца (приём «Истории ночи»)
    await page
      .locator('.ui-overlay')
      .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))
      .catch(() => undefined);
    await axe();
    await page.screenshot({ path: `${SHOTS}/form-${theme}-1440.png` });
    await page.keyboard.press('Escape');

    await page.goto(`/marketing/analytics?month=${month}`);
    await expect(page.getByTestId('budget-chart')).toBeVisible();
    await axe();
    await shot('analytics');

    expect(errors).toEqual([]);
  });
}
