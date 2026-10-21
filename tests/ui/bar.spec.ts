import { FIXTURE_API, expect, test, type Page, sideNav, openSection } from './fixtures';
import { signInForBar } from './bar-auth';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

/**
 * Бар по макету владельца 09.10.2026 (ADR-157): плитки с иконками, быстрая продажа и счёт гостя одной
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

test('обзор как на макете: пять KPI, графики, компактная доска и подробности', async ({ page }) => {
  mkdirSync(SHOTS, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/bar');
  const m = main(page);
  await expect(m.getByRole('heading', { level: 1 })).toHaveText('Склад');
  // Приход, продажа, инвентаризация в шапке; добавление товара у списка.
  await expect(m.getByRole('button', { name: 'Добавить товар', exact: true })).toBeVisible();
  await expect(m.getByRole('link', { name: 'Приход', exact: true })).toHaveAttribute('href', '/bar/receipts/new');
  await expect(m.getByRole('link', { name: 'Продажа', exact: true })).toBeVisible();
  await expect(m.getByRole('link', { name: 'Инвентаризация', exact: true })).toBeVisible();
  await expect(m.getByRole('navigation',{name:'Разделы бара'})).toBeVisible();
  await expect(m.getByRole('navigation', { name: 'Разделы бара' }).getByRole('link')).toHaveCount(5);
  // Без плиток над списком (аудит 21.10.2026 п.7): итоги месяца строкой под доской, нехватка строкой-предупреждением
  await expect(m.locator('.bar-kpi')).toHaveCount(0);
  const totals = m.getByTestId('bar-totals');
  await expect(totals).toContainText('закупки 412 800 ₸');
  await expect(totals).toContainText('выручка 1 245 600 ₸');
  await expect(totals).toContainText('прибыль от продаж 623 400 ₸');
  await expect(totals).toContainText('долг поставщикам 68 400 ₸');
  await expect(m.getByRole('heading', {name:'Продажи по дням',exact:true})).toBeVisible();
  await expect(m.getByTestId('bar-low-warning')).toContainText('Заканчиваются: 2 товара');
  // «Топ товаров» один раз: нижний дубль «Популярные товары» убран (п.12)
  await expect(m.getByRole('heading', { name: 'Популярные товары', exact: true })).toHaveCount(0);
  // доска: шесть товаров макета, поставщик и фактическая наценка, статус словом
  const board = m.getByRole('region', { name: 'Товары и остатки бара' });
  await expect(board.locator('tbody tr')).toHaveCount(6);
  const cola = board.locator('tbody tr', { hasText: 'Coca-Cola 0.5' });
  await expect(cola).toContainText('320 ₸');
  await expect(cola).toContainText('В норме');
  await expect(board.locator('tbody tr', { hasText: "Чипсы Lay's 90г" })).toContainText('Нет в наличии');
  await expect(board.locator('tbody tr', { hasText: 'Red Bull 0.25' })).toContainText('Заканчивается');
  // Карточка открывается по выбору товара, первый экран остаётся компактным.
  await board.getByRole('button', {name:'Coca-Cola 0.5',exact:true}).click();
  const card = m.getByRole('complementary', { name: 'Карточка товара Coca-Cola 0.5' });
  await expect(card).toBeVisible();
  await expect(card.getByRole('tab', { name: 'Информация' })).toHaveAttribute('aria-selected', 'true');
  await expect(card.getByLabel('Поставщик')).toHaveValue('FoodMaster');
  await expect(card.getByLabel('Наценка')).toHaveValue('88');
  await expect(card.getByLabel('Артикул (SKU)')).toHaveValue('CC-050');
  // Дополнительные сведения доступны по раскрытию.
  await m.getByText('Последние приходы',{exact:true}).click();
  const receipts = m.getByRole('region', { name: 'Последние приходы поставщиков' });
  await expect(receipts.locator('tbody tr')).toHaveCount(4);
  await expect(receipts.locator('tbody tr', { hasText: 'П-000122' })).toContainText('Не оплачен');
  await expect(m.getByRole('link', { name: 'Все приходы' })).toHaveAttribute('href', '/bar/receipts');
  await expect(m.locator('.bar-top-products li').first()).toContainText('Coca-Cola 0.5');
  await expect(m.locator('.bar-top-products li').first()).toContainText('142 шт.');
  // ничего не уезжает вбок
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: `${SHOTS}/overview-1440.png`, fullPage: true });
});

test('быстрая продажа одной строкой и фильтры доски', async ({ page }) => {
  await signInForBar(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/bar');
  const m = main(page);
  await m.getByRole('link', {name:'Продажа',exact:true}).click();
  // продажа открывается окном по центру (аудит 21.10.2026 п.13)
  const sale = page.getByRole('dialog', { name: 'Продажа' }).getByRole('tabpanel',{name:'Продажа напрямую',exact:true});
  await expect(sale.getByLabel('Количество, шт.')).toHaveValue('1');
  await sale.getByLabel('Товар').selectOption({ index: 1 });
  await sale.getByRole('button', { name: 'Продать' }).click();
  await expect(sale.locator('.bar-success[role="status"]')).toContainText('Продажа записана');
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

test('N6: товар в архивной категории сохраняет её при правке карточки (ADR-186)', async ({
  page,
  request,
}) => {
  const { token } = await (
    await request.post(`${fixture}/auth/login`, {
      data: { email: 'admin@wetop.test', password: 'ui-test-parol' },
      headers: { 'x-wetop-test-client': '1' },
    })
  ).json();
  const headers = { authorization: `Bearer ${token}`, 'x-wetop-test-client': '1' };
  const categories = (await (
    await request.get(`${fixture}/bar/categories`, { headers })
  ).json()) as Array<{ id: string; name: string }>;
  const juices = categories.find((c) => c.name === 'Соки')!;
  expect(
    (
      await request.patch(`${fixture}/bar/categories/${juices.id}/active`, {
        headers,
        data: { active: false },
      })
    ).ok(),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/bar');
  const m = main(page);
  const board = m.getByRole('region', { name: 'Товары и остатки бара' });
  await board.getByRole('button', { name: 'Изменить Сок Rich 0.2' }).click();
  const card = m.getByRole('complementary', { name: 'Карточка товара Сок Rich 0.2' });
  const select = card.getByLabel('Категория', { exact: true });
  await expect(select).toHaveValue(juices.id);
  await expect(select.locator('option:checked')).toHaveText('Соки (в архиве)');
  await card.getByLabel('Мин. остаток').fill('6');
  await card.getByRole('button', { name: 'Сохранить' }).click();
  await expect(card.getByRole('status').last()).toContainText('Карточка товара сохранена');
  const products = (await (
    await request.get(`${fixture}/bar/products`, { headers })
  ).json()) as Array<{ name: string; categoryId: string | null }>;
  expect(products.find((p) => p.name === 'Сок Rich 0.2')?.categoryId).toBe(juices.id);
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
  await m.getByRole('button', { name: 'Добавить товар',exact:true }).click();
  const card = m.getByRole('complementary', { name: 'Новый товар' });
  await expect(card).toBeVisible();
  await card.getByLabel('Название товара').fill('Чай зелёный');
  await expect(card.getByLabel('Артикул (SKU)')).toHaveValue('CHAY-ZELENYY');
  await card.getByLabel('Цена продажи').fill('500');
  await card.getByRole('button', { name: 'Сохранить' }).click();
  await expect(card.getByRole('status').last()).toContainText('Товар добавлен');
});

// верхнее меню 17.10.2026: экраны бара стали разделом «Склад»
test('меню: экраны бара в разделе «Склад», адреса бара подсвечивают его', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/bar/products');
  const nav = sideNav(page);
  await expect(nav.locator('.sidenav__current')).toHaveText('Склад');
  await expect(nav.locator('.sidenav__section', { hasText: /^Бар$/ })).toHaveCount(0);
  const items = await openSection(page, 'Склад');
  // пункты в порядке вкладок экрана склада (19.10.2026)
  await expect(items.locator('a')).toHaveText(['Обзор склада', 'Приходы', 'Номенклатура', 'Поставщики', 'Движение товаров']);
  await expect(items.getByRole('link', { name: 'Номенклатура', exact: true })).toHaveAttribute('aria-current', 'page');
  // у приходов свой пункт
  await page.goto('/bar/receipts');
  await expect(nav.locator('.sidenav__current')).toHaveText('Склад');
  await expect(nav.locator('.sidenav__items [aria-current="page"]')).toHaveText('Приходы');
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
  // «Новый товар» кнопкой в шапке, форма в окне; код подставляется из названия (аудит 21.10.2026 п.2, п.15)
  await products.getByRole('button', { name: 'Новый товар', exact: true }).click();
  const productForm = page.getByRole('dialog', { name: 'Новый товар' }).locator('.bar-product-form');
  await productForm.getByLabel('Название').fill('Чай чёрный');
  await expect(productForm.getByLabel('Код', { exact: true })).toHaveValue('CHAY-CHERNYY');
  await productForm.getByLabel('Начальная цена, ₸').fill('500');
  await productForm.getByRole('button', { name: 'Добавить товар' }).click();
  await expect(productForm.getByRole('status')).toContainText('Товар добавлен');
  await page.keyboard.press('Escape');
  await expect(products.getByRole('region', { name: 'Товары бара' })).toContainText('Чай чёрный');
  await page.goto('/bar/suppliers');
  const suppliers = main(page);
  await expect(suppliers.getByRole('region', { name: 'Поставщики бара' })).toContainText('Global Drinks');
  await suppliers.getByRole('button', { name: 'Новый поставщик', exact: true }).click();
  const supplierDialog = page.getByRole('dialog', { name: 'Новый поставщик' });
  await supplierDialog.getByLabel('Название').fill('ИП Снабжение');
  await supplierDialog.getByRole('button', { name: 'Добавить' }).click();
  await expect(supplierDialog.getByRole('status').first()).toContainText('Поставщик добавлен');
  await expect(suppliers.getByRole('region', { name: 'Поставщики бара' })).toContainText('ИП Снабжение');
});

test('операции: списание с причиной, журнал продаж и лента движений', async ({ page }) => {
  await page.goto('/bar/operations');
  const m = main(page);
  await m.getByRole('tab',{name:'Списание',exact:true}).click();
  const writeOff = m.locator('.bar-sale-form').first();
  await writeOff.getByLabel('Товар').selectOption({ index: 1 });
  await writeOff.getByLabel('Кол-во, шт.').fill('1');
  await writeOff.getByLabel('Причина').selectOption('Бой');
  await writeOff.getByRole('button', { name: 'Списать' }).click();
  await expect(writeOff.getByRole('status')).toContainText('Товар списан');
  await m.getByRole('tab',{name:'Продажи',exact:true}).click();
  await expect(m.getByRole('region', { name: 'Продажи бара' })).toContainText('Coca-Cola 0.5');
  // возврат продажи только через подтверждение (ADR-182): отказ ничего не меняет
  const saleRow = m.getByRole('region', { name: 'Продажи бара' }).locator('tbody tr').first();
  await saleRow.getByRole('button', { name: 'Вернуть на склад' }).click();
  const confirm = page.getByTestId('confirm-dialog');
  await confirm.getByRole('button', { name: 'Оставить как есть' }).click();
  await expect(saleRow).toContainText('Продано');
  await saleRow.getByRole('button', { name: 'Вернуть на склад' }).click();
  await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Вернуть на склад' }).click();
  await expect(m.getByRole('region', { name: 'Продажи бара' }).locator('tbody tr').first()).toContainText('Возврат');
  await m.getByRole('tab',{name:'Движения',exact:true}).click();
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
