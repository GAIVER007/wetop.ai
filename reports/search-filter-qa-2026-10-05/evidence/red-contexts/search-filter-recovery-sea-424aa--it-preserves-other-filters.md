# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: search-filter-recovery.spec.ts >> search/filter recovery 1440 >> finance: empty refunds keep method and resetting it preserves other filters
- Location: tests/ui/search-filter-recovery.spec.ts:77:5

# Error details

```
Error: expect(locator).toHaveValue(expected) failed

Locator:  getByRole('combobox', { name: 'Способ оплаты', exact: true })
Expected: "CASH"
Received: ""
Timeout:  15000ms

Call log:
  - Expect "toHaveValue" getByRole('combobox', { name: 'Способ оплаты', exact: true }) with timeout 15000ms
  - waiting for getByRole('combobox', { name: 'Способ оплаты', exact: true })
    33 × locator resolved to <select class="inp" name="method" aria-label="Способ оплаты">…</select>
       - unexpected value ""

```

```yaml
- combobox "Способ оплаты":
  - option "Все способы" [selected]
  - option "Наличные"
  - option "Карта (терминал)"
  - option "Kaspi"
  - option "Halyk"
  - option "Перевод от физлица"
  - option "Перевод от юрлица"
  - option "Депозит"
  - option "Гарантия картой"
  - option "Внешний канал"
```

# Test source

```ts
  1   | import { FIXTURE_API, expect, test, settleStreaming } from './fixtures';
  2   | 
  3   | // Synthetic loopback API. UI state evidence, not production or database evidence.
  4   | const arrival = '2026-10-10';
  5   | const departure = '2026-10-12';
  6   | const search = `/rooms/availability?arrival=${arrival}&departure=${departure}&guests=2`;
  7   | 
  8   | test.beforeEach(async ({ request }) => {
  9   |   await request.post(`${FIXTURE_API}/__test/reset`);
  10  | });
  11  | 
  12  | for (const width of [1440, 390]) {
  13  |   test.describe(`search/filter recovery ${width}`, () => {
  14  |     test.beforeEach(async ({ page }) => {
  15  |       await page.setViewportSize({ width, height: 844 });
  16  |     });
  17  | 
  18  |     for (const preset of ['Завтра', 'Выходные']) {
  19  |       test(`availability: ${preset} updates edited fields and repeated search`, async ({
  20  |         page,
  21  |       }) => {
  22  |         await page.goto(search);
  23  |         await page.getByLabel('Заезд', { exact: true }).fill('2026-10-13');
  24  |         await page.getByLabel('Выезд', { exact: true }).fill('2026-10-15');
  25  |         const link = page.getByRole('link', { name: preset, exact: true });
  26  |         const target = new URL((await link.getAttribute('href'))!, page.url());
  27  |         await link.click();
  28  |         await expect(page).toHaveURL(target.href);
  29  |         await expect(page.getByLabel('Заезд', { exact: true })).toHaveValue(
  30  |           target.searchParams.get('arrival')!,
  31  |         );
  32  |         await expect(page.getByLabel('Выезд', { exact: true })).toHaveValue(
  33  |           target.searchParams.get('departure')!,
  34  |         );
  35  |         await page.getByRole('button', { name: 'Найти', exact: true }).click();
  36  |         await expect(page).toHaveURL(target.href);
  37  |       });
  38  |     }
  39  | 
  40  |     test('availability: manual input is a draft until Find; category survives reload and history', async ({
  41  |       page,
  42  |     }) => {
  43  |       await page.goto(`${search}&category=MALE`);
  44  |       const category = page.getByRole('combobox', { name: 'Категория', exact: true });
  45  |       await expect(category).toHaveValue('MALE');
  46  |       await page.getByLabel('Заезд', { exact: true }).fill('2026-10-13');
  47  |       await page.getByLabel('Выезд', { exact: true }).fill('2026-10-16');
  48  |       await page.getByLabel('Гостей', { exact: true }).fill('3');
  49  |       await expect(page).toHaveURL(
  50  |         new RegExp(`arrival=${arrival}&departure=${departure}&guests=2&category=MALE`),
  51  |       );
  52  |       await expect(page.getByLabel('Заезд', { exact: true })).toHaveValue('2026-10-13');
  53  |       await expect(page.locator('.fund-counts')).toContainText('2 ночи');
  54  |       await page.getByRole('button', { name: 'Найти', exact: true }).click();
  55  |       await expect(page).toHaveURL(/arrival=2026-10-13&departure=2026-10-16&guests=3/);
  56  |       expect(new URL(page.url()).searchParams.get('category')).toBe('MALE');
  57  |       await page.reload();
  58  |       await expect(category).toHaveValue('MALE');
  59  |       await expect(page.getByLabel('Заезд', { exact: true })).toHaveValue('2026-10-13');
  60  |       await page.goBack();
  61  |       await expect(page.getByLabel('Заезд', { exact: true })).toHaveValue(arrival);
  62  |       await page.goForward();
  63  |       await expect(page.getByLabel('Выезд', { exact: true })).toHaveValue('2026-10-16');
  64  |       await expect(category).toHaveValue('MALE');
  65  |     });
  66  | 
  67  |     test('availability: calendar transfers its inclusive range and category', async ({ page }) => {
  68  |       await page.goto('/chessboard?from=2026-10-10&to=2026-10-12&category=MALE');
  69  |       await page.getByRole('link', { name: 'Поиск свободных номеров', exact: true }).click();
  70  |       await expect(page.getByLabel('Заезд', { exact: true })).toHaveValue('2026-10-10');
  71  |       await expect(page.getByLabel('Выезд', { exact: true })).toHaveValue('2026-10-13');
  72  |       await expect(page.getByRole('combobox', { name: 'Категория', exact: true })).toHaveValue(
  73  |         'MALE',
  74  |       );
  75  |     });
  76  | 
  77  |     test('finance: empty refunds keep method and resetting it preserves other filters', async ({
  78  |       page,
  79  |     }) => {
  80  |       const url =
  81  |         '/finance?from=2026-10-05&to=2026-10-05&op=refund&method=CASH&src=cash#operations';
  82  |       await page.goto(url);
  83  |       await expect(page.getByTestId('ops-empty')).toBeVisible();
  84  |       const method = page.getByRole('combobox', { name: 'Способ оплаты', exact: true });
  85  |       await expect(method).toBeVisible();
  86  |       await expect(method).toHaveValue('CASH');
  87  |       await page.reload();
  88  |       await expect(method).toHaveValue('CASH');
  89  |       await method.selectOption('');
  90  |       await page.getByRole('button', { name: 'Показать', exact: true }).click();
  91  |       const q = new URL(page.url()).searchParams;
  92  |       expect(q.get('method')).toBe('');
  93  |       expect(q.get('op')).toBe('refund');
  94  |       expect(q.get('src')).toBe('cash');
  95  |       expect(q.get('from')).toBe('2026-10-05');
  96  |       expect(q.get('to')).toBe('2026-10-05');
  97  |       await page.goBack();
> 98  |       await expect(method).toHaveValue('CASH');
      |                            ^ Error: expect(locator).toHaveValue(expected) failed
  99  |       await page.goForward();
  100 |       await expect(method).toHaveValue('');
  101 |     });
  102 | 
  103 |     test('rates: empty row is rejected, zero nights and false restrictions remain changes', async ({
  104 |       page,
  105 |     }) => {
  106 |       await page.goto('/rates?month=2026-10');
  107 |       await page.getByTestId('rates-edit-open').click();
  108 |       const editor = page.getByTestId('bulk-editor');
  109 |       const add = editor.getByRole('button', { name: '+ Добавить в список', exact: true });
  110 |       await add.click();
  111 |       await expect(editor.getByRole('alert')).toContainText('Укажите хотя бы одно изменение');
  112 |       await expect(editor.getByTestId('pending-changes')).toHaveCount(0);
  113 |       await expect(editor.getByTestId('apply-changes')).toBeDisabled();
  114 |       await editor.getByLabel('Мин. ночей', { exact: true }).fill('0');
  115 |       await add.click();
  116 |       await expect(editor.getByTestId('pending-changes')).toContainText('мин. ночей 0');
  117 |       await editor.getByLabel('Стоп-продажа', { exact: true }).selectOption('false');
  118 |       await add.click();
  119 |       await expect(editor.getByTestId('pending-changes')).toContainText('стоп-продажа нет');
  120 |       await expect(editor.getByTestId('apply-changes')).toHaveText('Сохранить 2 изменения');
  121 |     });
  122 | 
  123 |     test('print: KZ and RU survive form changes, reload and history', async ({ page }) => {
  124 |       await page.goto('/reports/print?form=day&date=2026-10-05');
  125 |       await page.getByRole('link', { name: 'KZ', exact: true }).click();
  126 |       await settleStreaming(page);
  127 |       await expect(page.getByRole('heading', { level: 1 })).toHaveText('Күн бойынша жиынтық');
  128 |       await page.getByRole('link', { name: 'Список проживающих', exact: true }).click();
  129 |       await settleStreaming(page);
  130 |       expect(new URL(page.url()).searchParams.get('lang')).toBe('kz');
  131 |       expect(new URL(page.url()).searchParams.get('date')).toBe('2026-10-05');
  132 |       await expect(page.getByRole('heading', { level: 1 })).toHaveText(
  133 |         'Тұрып жатқан қонақтар тізімі',
  134 |       );
  135 |       await page.reload();
  136 |       await expect(page.getByRole('heading', { level: 1 })).toHaveText(
  137 |         'Тұрып жатқан қонақтар тізімі',
  138 |       );
  139 |       await page.goBack();
  140 |       await expect(page.getByRole('heading', { level: 1 })).toHaveText('Күн бойынша жиынтық');
  141 |       await page.goForward();
  142 |       await expect(page.getByRole('heading', { level: 1 })).toHaveText(
  143 |         'Тұрып жатқан қонақтар тізімі',
  144 |       );
  145 |       await page.getByRole('link', { name: 'Сводка дня', exact: true }).click();
  146 |       await expect(page.getByRole('heading', { level: 1 })).toHaveText('Күн бойынша жиынтық');
  147 |       await page.getByRole('link', { name: 'RU', exact: true }).click();
  148 |       await page.getByRole('link', { name: 'Список проживающих', exact: true }).click();
  149 |       await expect(page.getByRole('heading', { level: 1 })).toHaveText('Список проживающих');
  150 |       expect(new URL(page.url()).searchParams.get('lang')).toBe('ru');
  151 |       await page.reload();
  152 |       await expect(page.getByRole('heading', { level: 1 })).toHaveText('Список проживающих');
  153 |     });
  154 |   });
  155 | }
  156 | 
```