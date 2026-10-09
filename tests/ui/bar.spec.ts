import { FIXTURE_API, expect, test, type Page } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

/**
 * Бар по макету владельца 09.10.2026 (ADR-154): плитки с иконками, быстрая продажа и счёт гостя одной
 * строкой, «Товары и остатки» с карточкой товара справа, приходы поставщиков и популярные товары; приходы с
 * ИИ-сканом накладной и подстраницы раздела; пункт меню в группе «Финансы». Подставной API повторяет
 * наполнение макета (`scripts/preview/bar-fixture.ts`). Гости вымышленные (ADR-010).
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

test('обзор как на макете: шапка, семь плиток, продажа строкой, доска, приходы и популярные', async ({ page }) => {
  mkdirSync(SHOTS, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/bar');
  const m = main(page);
  await expect(m.getByRole('heading', { level: 1 })).toHaveText('Бар');
  // шапка: «Добавить товар» главной, затем «Приход», «Продажа», «Инвентаризация» и «⋯»; вкладок на обзоре нет
  await expect(m.getByRole('link', { name: 'Добавить товар' })).toHaveAttribute('href', '/bar?product=new');
  await expect(m.getByRole('link', { name: 'Приход', exact: true })).toHaveAttribute('href', '/bar/receipts/new');
  await expect(m.getByRole('link', { name: 'Продажа', exact: true })).toBeVisible();
  await expect(m.getByRole('link', { name: 'Инвентаризация', exact: true })).toBeVisible();
  await expect(m.getByRole('button', { name: 'Ещё разделы бара' })).toBeVisible();
  await expect(m.getByRole('navigation', { name: 'Разделы бара' })).toHaveCount(0);
  // семь плиток с подписями макета
  const kpis = m.getByRole('region', { name: 'Показатели бара' });
  await expect(kpis.locator('.bar-kpi-label')).toHaveText([
    'Товаров', 'Остаток на складе', 'Закуплено за месяц', 'Выручка бара', 'Валовая прибыль', 'Долг поставщикам', 'Заканчиваются',
  ]);
  await expect(kpis.locator('.bar-kpi', { hasText: 'Остаток на складе' })).toContainText('107 шт.');
  await expect(kpis.locator('.bar-kpi', { hasText: 'Закуплено за месяц' })).toContainText('+12% к прошлому месяцу');
  await expect(kpis.locator('.bar-kpi', { hasText: 'Выручка бара' })).toContainText('+18% к прошлому месяцу');
  await expect(kpis.locator('.bar-kpi', { hasText: 'Валовая прибыль' })).toContainText('маржинальность 50%');
  await expect(kpis.locator('.bar-kpi--alarm')).toContainText('2');
  // доска: шесть товаров макета, поставщик и фактическая наценка, статус словом
  const board = m.getByRole('region', { name: 'Товары и остатки бара' });
  await expect(board.locator('tbody tr')).toHaveCount(6);
  const cola = board.locator('tbody tr', { hasText: 'Coca-Cola 0.5' });
  await expect(cola).toContainText('FoodMaster');
  await expect(cola).toContainText('320 ₸');
  await expect(cola).toContainText('88%');
  await expect(cola).toContainText('В норме');
  await expect(board.locator('tbody tr', { hasText: "Чипсы Lay's 90г" })).toContainText('Нет в наличии');
  await expect(board.locator('tbody tr', { hasText: 'Red Bull 0.25' })).toContainText('Заканчивается');
  // карточка первого товара открыта справа сразу, как на макете
  const card = m.getByRole('complementary', { name: 'Карточка товара Coca-Cola 0.5' });
  await expect(card).toBeVisible();
  await expect(card.getByRole('tab', { name: 'Информация' })).toHaveAttribute('aria-selected', 'true');
  await expect(card.getByLabel('Поставщик')).toHaveValue('FoodMaster');
  await expect(card.getByLabel('Артикул (SKU)')).toHaveValue('CC-050');
  // нижний ряд
  const receipts = m.getByRole('region', { name: 'Последние приходы поставщиков' });
  await expect(receipts.locator('tbody tr')).toHaveCount(4);
  await expect(receipts.locator('tbody tr', { hasText: 'П-000122' })).toContainText('Не оплачен');
  await expect(m.getByRole('link', { name: 'Все приходы' })).toHaveAttribute('href', '/bar/receipts');
  await expect(m.locator('.bar-popular li').first()).toContainText('Coca-Cola 0.5');
  await expect(m.locator('.bar-popular li').first()).toContainText('142 шт.');
  // ничего не уезжает вбок
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: `${SHOTS}/overview-1440.png`, fullPage: true });
});

test('быстрая продажа одной строкой и фильтры доски', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/bar');
  const m = main(page);
  const sale = m.locator('#bar-quick-sale');
  await expect(sale.getByLabel('Количество, шт.')).toHaveValue('1');
  await sale.getByLabel('Товар').selectOption({ index: 1 });
  await sale.getByRole('button', { name: 'Продать' }).click();
  await expect(sale.getByRole('status')).toContainText('Продажа записана');
  const board = m.getByRole('region', { name: 'Товары и остатки бара' });
  await m.getByLabel('Поиск товара').fill('red');
  await expect(board.locator('tbody tr')).toHaveCount(1);
  await m.getByLabel('Поиск товара').fill('');
  await m.getByLabel('Статус остатка').selectOption('out');
  await expect(board.locator('tbody tr')).toHaveCount(1);
  await expect(board.locator('tbody tr')).toContainText("Чипсы Lay's 90г");
  await m.getByLabel('Статус остатка').selectOption('');
  await m.getByRole('combobox', { name: 'Поставщик', exact: true }).selectOption({ label: 'SnackMarket' });
  await expect(board.locator('tbody tr')).toHaveCount(2);
  await m.getByRole('combobox', { name: 'Поставщик', exact: true }).selectOption('');
  await m.getByLabel('Период последнего прихода').selectOption('7');
  await expect(board.locator('tbody tr')).toHaveCount(3);
});

test('карточка товара: «Изменить цены» пересчитывает от закупки, «Сохранить» пишет, история и списание', async ({ page }) => {
  mkdirSync(SHOTS, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/bar');
  const m = main(page);
  const board = m.getByRole('region', { name: 'Товары и остатки бара' });
  await board.getByRole('button', { name: 'Изменить Red Bull 0.25' }).click();
  const card = m.getByRole('complementary', { name: 'Карточка товара Red Bull 0.25' });
  await expect(card.getByLabel('Закупочная цена')).toHaveValue('550');
  // 550 ₸ + 88 % = 1034 ₸, вверх до 10 тенге: 1040 ₸
  await card.getByRole('button', { name: 'Изменить цены' }).click();
  await expect(card.getByLabel('Цена продажи')).toHaveValue('1040');
  await card.getByLabel('Мин. остаток').fill('8');
  await page.screenshot({ path: `${SHOTS}/product-panel.png` });
  await card.getByRole('button', { name: 'Сохранить' }).click();
  await expect(card.getByRole('status').last()).toContainText('Карточка товара сохранена');
  await expect(board.locator('tbody tr', { hasText: 'Red Bull 0.25' })).toContainText('1 040 ₸');
  // «Переместить»: склад один, кнопка выключена
  await expect(card.getByRole('button', { name: 'Переместить' })).toBeDisabled();
  // списание прямо из карточки
  await card.getByRole('button', { name: 'Списать' }).click();
  const writeOff = card.getByRole('form', { name: 'Списание: Red Bull 0.25' });
  await writeOff.getByLabel('Причина списания').selectOption('Бой');
  await writeOff.getByRole('button', { name: 'Списать' }).click();
  await expect(writeOff.getByRole('status')).toContainText('Товар списан');
  // история у Coca-Cola: приход и продажа
  await board.getByRole('button', { name: 'Изменить Coca-Cola 0.5' }).click();
  const cola = m.getByRole('complementary', { name: 'Карточка товара Coca-Cola 0.5' });
  await cola.getByRole('tab', { name: 'История' }).click();
  await expect(cola.locator('.bar-history li')).toHaveCount(2);
  await expect(cola.locator('.bar-history')).toContainText('Приход');
});

test('«Удалить» уводит товар в архив после вопроса; флажки отмечают строки', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/bar');
  const m = main(page);
  const board = m.getByRole('region', { name: 'Товары и остатки бара' });
  await board.getByRole('checkbox', { name: 'Отметить Red Bull 0.25' }).check();
  await board.getByRole('checkbox', { name: 'Отметить Сок Rich 0.2' }).check();
  await expect(m.getByRole('toolbar', { name: 'Отмеченные товары' })).toContainText('Отмечено: 2');
  await m.getByRole('toolbar', { name: 'Отмеченные товары' }).getByRole('button', { name: 'Снять отметку' }).click();
  await board.getByRole('button', { name: "Действия: Чипсы Lay's 90г" }).click();
  await page.getByRole('menuitem', { name: 'Удалить' }).click();
  await expect(page.getByRole('heading', { name: "Удалить «Чипсы Lay's 90г»?" })).toBeVisible();
  await page.getByRole('button', { name: 'Удалить в архив' }).click();
  await expect(board.locator('tbody tr', { hasText: "Чипсы Lay's 90г" })).toHaveCount(0);
  await expect(board.locator('tbody tr')).toHaveCount(5);
});

test('«Добавить товар» открывает карточку нового товара справа; код предлагается из названия', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/bar');
  const m = main(page);
  await m.getByRole('link', { name: 'Добавить товар' }).click();
  const card = m.getByRole('complementary', { name: 'Новый товар' });
  await expect(card).toBeVisible();
  await card.getByLabel('Название товара').fill('Чай зелёный');
  await expect(card.getByLabel('Артикул (SKU)')).toHaveValue('CHAY-ZELENYY');
  await card.getByLabel('Цена продажи').fill('500');
  await card.getByRole('button', { name: 'Сохранить' }).click();
  await expect(card.getByRole('status').last()).toContainText('Товар добавлен');
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
  await expect(menu.getByRole('link', { name: 'Бар', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('новый приход: ИИ-скан заполняет строки, новый товар создаётся вместе с приходом', async ({ page }) => {
  mkdirSync(SHOTS, { recursive: true });
  await page.goto('/bar/receipts/new');
  const m = main(page);
  await expect(m.getByRole('heading', { level: 1 })).toHaveText('Новый приход');
  await m.getByLabel('Фото накладной или счёта-фактуры').setInputFiles({ name: 'invoice.png', mimeType: 'image/png', buffer: PNG });
  await m.getByRole('button', { name: 'Распознать и заполнить' }).click();
  await expect(m.getByRole('status').first()).toContainText('Распознано строк: 2, новых товаров: 1');
  await expect(m.getByLabel('Номер счёта-фактуры')).toHaveValue('SF-123');
  await expect(m.getByLabel('Дата документа')).toHaveValue('2026-10-08');
  await expect(m.getByLabel('Поставщик').locator('option:checked')).toHaveText('FoodMaster');
  // первая строка нашлась по штрихкоду, наценка пришла из категории товара
  const lines = m.locator('.bar-line');
  await expect(lines).toHaveCount(2);
  await expect(lines.first().getByLabel('Товар').locator('option:checked')).toHaveText('Coca-Cola 0.5');
  await expect(lines.first().getByLabel('Кол-во, шт.')).toHaveValue('24');
  await expect(lines.first().getByLabel('Наценка, %')).toHaveValue('88.00');
  await expect(lines.nth(1).getByLabel('Новый товар: название')).toHaveValue('Сок яблочный 1л');
  await expect(lines.nth(1).getByLabel('Код карточки')).toHaveValue('SOK-YABLOCHNYY-1L');
  await expect(m.getByText('Количество колы пересчитано из упаковок', { exact: false })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/receipt-scan.png`, fullPage: true });
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
  await m.getByRole('button', { name: 'Строка с новым товаром' }).click();
  const line = m.locator('.bar-line').nth(1);
  await line.getByLabel('Новый товар: название').fill('Чай зелёный');
  await expect(line.getByLabel('Код карточки')).toHaveValue('CHAY-ZELENYY');
});

test('подстраницы: оплата долга в приходах, новый товар в каталоге, расчёты с поставщиками', async ({ page }) => {
  await page.goto('/bar/receipts');
  const m = main(page);
  const row = m.getByRole('region', { name: 'Приходы бара' }).locator('tbody tr', { hasText: 'П-000122' });
  await row.getByRole('button', { name: 'Оплатить' }).click();
  await expect(row).toContainText('Оплачено');
  await page.goto('/bar/products');
  const products = main(page);
  const productForm = products.locator('.bar-product-form');
  await productForm.getByLabel('Код', { exact: true }).fill('TEA-1');
  await productForm.getByLabel('Название').fill('Чай чёрный');
  await productForm.getByLabel('Начальная цена, ₸').fill('500');
  await productForm.getByRole('button', { name: 'Добавить товар' }).click();
  await expect(productForm.getByRole('status')).toContainText('Товар добавлен');
  await expect(products.getByRole('region', { name: 'Товары бара' })).toContainText('Чай чёрный');
  await page.goto('/bar/suppliers');
  const suppliers = main(page);
  await expect(suppliers.getByRole('region', { name: 'Поставщики бара' })).toContainText('Global Drinks');
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
  await expect(m.getByRole('region', { name: 'Продажи бара' })).toContainText('Coca-Cola 0.5');
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
      // телефон: без горизонтальной прокрутки страницы, таблица листается внутри себя
      await page.setViewportSize({ width: 390, height: 844 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `${route} ${theme} 390px`,
      ).toBe(true);
    }
  });
}
