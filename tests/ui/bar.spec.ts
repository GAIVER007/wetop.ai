import { FIXTURE_API, expect, test, type Page } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

/**
 * Бар на подстраницах (ADR-153, план bar-redesign-2026-10-09): обзор одним экраном, приходы с ИИ-сканом
 * накладной, товары, поставщики и операции своими вкладками; пункт меню живёт в группе «Финансы».
 * Подставной ИИ отвечает из `scripts/preview/bar-fixture.ts`: одна строка совпадает по штрихкоду,
 * вторая: новый товар. Гости и поставщики вымышленные (ADR-010).
 */
const fixture = FIXTURE_API;
const SHOTS = 'reports/bar-redesign-2026-10-09';
const main = (page: Page) => page.getByRole('main').filter({ visible: true });
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('обзор по макету: показатели, быстрая продажа, доска товаров, приходы и популярные', async ({ page }) => {
  mkdirSync(SHOTS, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/bar');
  const m = main(page);
  await expect(m.getByRole('heading', { level: 1 })).toHaveText('Бар');
  // пять вкладок раздела, активен «Обзор»; действия шапки как в макете
  const tabs = m.getByRole('navigation', { name: 'Разделы бара' });
  await expect(tabs.getByRole('link')).toHaveText(['Обзор', 'Приходы', 'Товары', 'Поставщики', 'Операции']);
  await expect(tabs.getByRole('link', { name: 'Обзор' })).toHaveAttribute('aria-current', 'page');
  await expect(m.getByRole('link', { name: 'Добавить товар' })).toBeVisible();
  await expect(m.getByRole('link', { name: 'Приход', exact: true })).toBeVisible();
  // семь плиток: остаток на складе суммой, долг и «заканчиваются» подсвечены
  await expect(m.locator('.bar-stats .stat')).toHaveCount(7);
  await expect(m.getByText('Остаток на складе')).toBeVisible();
  await expect(m.locator('.stat', { hasText: 'Остаток на складе' })).toContainText('16 шт.');
  await expect(m.locator('.stat', { hasText: 'Заканчиваются' })).toContainText('1');
  // первый экран без прокрутки: показатели и быстрая продажа видны сразу, вбок ничего не уезжает
  const quick = await m.locator('.bar-quick').boundingBox();
  expect(quick!.y).toBeLessThan(900);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  // доска товаров: статус словом, товар на минимуме наверху
  const board = m.getByRole('region', { name: 'Товары и остатки бара' });
  await expect(board.locator('tbody tr').first()).toContainText('Вода 1 л');
  await expect(board.locator('tbody tr').first()).toContainText('Заканчивается');
  // поиск и фильтр статуса сужают список
  await m.getByLabel('Поиск товара').fill('cola');
  await expect(board.locator('tbody tr')).toHaveCount(1);
  await expect(board.locator('tbody tr').first()).toContainText('Cola 0,5');
  await m.getByLabel('Поиск товара').fill('');
  await m.getByLabel('Статус остатка').selectOption('low');
  await expect(board.locator('tbody tr')).toHaveCount(1);
  await m.getByLabel('Статус остатка').selectOption('');
  // нижний ряд макета: приходы со статусом оплаты и популярные товары
  await expect(m.getByText('Приходы от поставщиков')).toBeVisible();
  const receiptsPanel = m.getByRole('region', { name: 'Последние приходы поставщиков' });
  await expect(receiptsPanel.locator('tbody tr').first()).toContainText('SF-77');
  await expect(receiptsPanel.locator('tbody tr').first()).toContainText('Оплачен частично');
  await expect(m.getByRole('link', { name: 'Все приходы' })).toHaveAttribute('href', '/bar/receipts');
  await expect(m.locator('.bar-popular li').first()).toContainText('Cola 0,5');
  // продажа без брони с обзора
  const sale = m.locator('.bar-sale-form').first();
  await sale.getByLabel('Товар').selectOption({ index: 1 });
  await sale.getByLabel('Кол-во, шт.').fill('1');
  await sale.getByRole('button', { name: 'Продать' }).click();
  await expect(sale.getByRole('status')).toContainText('Продажа записана');
  await page.screenshot({ path: `${SHOTS}/overview-1440.png`, fullPage: true });
});

test('карточка товара боковой панелью: правка полей и цены, закрытие Escape', async ({ page }) => {
  mkdirSync(SHOTS, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/bar');
  const m = main(page);
  const board = m.getByRole('region', { name: 'Товары и остатки бара' });
  await board.locator('tbody tr', { hasText: 'Cola 0,5' }).getByRole('button', { name: 'Изменить' }).click();
  const panel = page.getByRole('dialog', { name: 'Карточка товара Cola 0,5' });
  await expect(panel).toBeVisible();
  await expect(panel.getByText('Текущий остаток')).toBeVisible();
  await panel.getByLabel('Название товара').fill('Cola 0,5 ж/б');
  await panel.getByLabel('Мин. остаток').fill('8');
  await panel.getByLabel('Цена продажи, ₸').fill('750');
  await page.screenshot({ path: `${SHOTS}/product-panel.png` });
  await panel.getByRole('button', { name: 'Сохранить' }).click();
  await expect(panel.getByRole('status')).toContainText('Карточка товара сохранена');
  await expect(board.locator('tbody tr', { hasText: 'Cola 0,5 ж/б' })).toContainText('750');
  // Escape закрывает карточку, таблица остаётся
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: /Карточка товара/ })).toHaveCount(0);
  await expect(board).toBeVisible();
});

test('меню: «Бар» живёт в группе «Финансы», адреса бара подсвечивают её', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/bar/products');
  const menu = page.locator('.workspace-header').getByRole('navigation', { name: 'Разделы' });
  const finance = menu.getByRole('button', { name: 'Финансы', exact: true });
  await expect(finance).toHaveClass(/has-current-page/);
  await expect(menu.locator('.topmenu__tab', { hasText: 'Бар' })).toHaveCount(0);
  await finance.click();
  await expect(menu.getByRole('link', { name: 'Оплаты и касса', exact: true })).toBeVisible();
  const bar = menu.getByRole('link', { name: 'Бар', exact: true });
  await expect(bar).toHaveAttribute('aria-current', 'page');
});

test('новый приход: ИИ-скан заполняет строки, новый товар создаётся вместе с приходом', async ({ page }) => {
  mkdirSync(SHOTS, { recursive: true });
  await page.goto('/bar/receipts/new');
  const m = main(page);
  await expect(m.getByRole('heading', { level: 1 })).toHaveText('Новый приход');
  await m.getByLabel('Фото накладной или счёта-фактуры').setInputFiles({ name: 'invoice.png', mimeType: 'image/png', buffer: PNG });
  await m.getByRole('button', { name: 'Распознать и заполнить' }).click();
  await expect(m.getByRole('status').first()).toContainText('Распознано строк: 2, новых товаров: 1');
  // шапка из документа; поставщик совпал по названию
  await expect(m.getByLabel('Номер счёта-фактуры')).toHaveValue('SF-123');
  await expect(m.getByLabel('Дата документа')).toHaveValue('2026-10-08');
  await expect(m.getByLabel('Поставщик').locator('option:checked')).toHaveText('ТОО «Алматы Напитки»');
  // первая строка нашлась по штрихкоду, наценка пришла из категории товара
  const lines = m.locator('.bar-line');
  await expect(lines).toHaveCount(2);
  await expect(lines.first().getByLabel('Товар').locator('option:checked')).toHaveText('Cola 0,5');
  await expect(lines.first().getByLabel('Кол-во, шт.')).toHaveValue('24');
  await expect(lines.first().getByLabel('Наценка, %')).toHaveValue('35.00');
  // вторая строка: новый товар с предложенным кодом; предупреждение скана на экране
  await expect(lines.nth(1).getByLabel('Новый товар: название')).toHaveValue('Сок яблочный 1л');
  await expect(lines.nth(1).getByLabel('Код карточки')).toHaveValue('SOK-YABLOCHNYY-1L');
  await expect(m.getByText('Количество колы пересчитано из упаковок', { exact: false })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/receipt-scan.png`, fullPage: true });
  // сохранение создаёт карточку и проводит приход
  await m.getByRole('button', { name: 'Сохранить приход' }).click();
  await expect(m.getByRole('status').nth(1)).toContainText('Приход проведен');
  await page.goto('/bar/products');
  await expect(main(page).getByRole('region', { name: 'Товары бара' })).toContainText('Сок яблочный 1л');
  await page.goto('/bar/receipts');
  await expect(main(page).getByRole('region', { name: 'Приходы бара' })).toContainText('SF-123');
});

test('скан бережёт руки, но не выключает их: PDF отклоняется словами, строки добавляются вручную', async ({ page }) => {
  await page.goto('/bar/receipts/new');
  const m = main(page);
  await m.getByLabel('Фото накладной или счёта-фактуры').setInputFiles({ name: 'invoice.pdf', mimeType: 'application/pdf', buffer: PNG });
  await m.getByRole('button', { name: 'Распознать и заполнить' }).click();
  await expect(m.getByRole('alert')).toContainText('PDF');
  // ручной путь остаётся полным: строка с новым товаром без скана
  await m.getByRole('button', { name: 'Строка с новым товаром' }).click();
  const line = m.locator('.bar-line').nth(1);
  await line.getByLabel('Новый товар: название').fill('Чай зелёный');
  await expect(line.getByLabel('Код карточки')).toHaveValue('CHAY-ZELENYY');
});

test('приходы: оплата долга из журнала; товары: новый товар и цена в строке; поставщики: расчёты', async ({ page }) => {
  await page.goto('/bar/receipts');
  const m = main(page);
  const row = m.getByRole('region', { name: 'Приходы бара' }).locator('tbody tr', { hasText: 'SF-77' });
  await row.getByRole('button', { name: 'Оплатить' }).click();
  // полный расчёт: после обновления строки вместо формы оплаты стоит «Оплачено»
  await expect(row).toContainText('Оплачено');
  // товары: добавление через форму (поле «Название» есть и у категорий, берём форму товара)
  await page.goto('/bar/products');
  const products = main(page);
  const productForm = products.locator('.bar-product-form');
  await productForm.getByLabel('Код', { exact: true }).fill('TEA-1');
  await productForm.getByLabel('Название').fill('Чай чёрный');
  await productForm.getByLabel('Начальная цена, ₸').fill('500');
  await productForm.getByRole('button', { name: 'Добавить товар' }).click();
  await expect(productForm.getByRole('status')).toContainText('Товар добавлен');
  await expect(products.getByRole('region', { name: 'Товары бара' })).toContainText('Чай чёрный');
  // поставщики: долг виден по каждому, новый добавляется
  await page.goto('/bar/suppliers');
  const suppliers = main(page);
  await expect(suppliers.getByRole('region', { name: 'Поставщики бара' }).locator('tbody tr').first()).toContainText('ТОО «Алматы Напитки»');
  await suppliers.getByLabel('Название').fill('ИП Снабжение');
  await suppliers.getByRole('button', { name: 'Добавить' }).click();
  await expect(suppliers.getByRole('status').first()).toContainText('Поставщик добавлен');
  await expect(suppliers.getByRole('region', { name: 'Поставщики бара' })).toContainText('ИП Снабжение');
});

test('операции: списание с причиной, журнал продаж и лента движений', async ({ page }) => {
  await page.goto('/bar/operations');
  const m = main(page);
  const writeOff = m.locator('.bar-sale-form').first();
  await writeOff.getByLabel('Товар').selectOption({ index: 1 });
  await writeOff.getByLabel('Кол-во, шт.').fill('1');
  await writeOff.getByLabel('Причина').selectOption('Бой');
  await writeOff.getByRole('button', { name: 'Списать' }).click();
  await expect(writeOff.getByRole('status')).toContainText('Товар списан');
  await expect(m.getByRole('region', { name: 'Продажи бара' })).toContainText('Cola 0,5');
  await expect(m.getByRole('region', { name: 'Движения остатка бара' })).toContainText('Приход');
});

for (const theme of ['light', 'dark'] as const) {
  test(`доступность и телефон: ${theme}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    for (const route of ['/bar', '/bar/receipts/new']) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(route);
      await expect(main(page).getByRole('heading', { level: 1 })).toBeVisible();
      const audit = await new AxeBuilder({ page })
        .include('main')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(audit.violations, `${route} ${theme}`).toEqual([]);
      // телефон: без горизонтальной прокрутки
      await page.setViewportSize({ width: 390, height: 844 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `${route} ${theme} 390px`,
      ).toBe(true);
    }
  });
}
