# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: search-filter-recovery.spec.ts >> search/filter recovery 1440 >> print: KZ and RU survive form changes, reload and history
- Location: tests/ui/search-filter-recovery.spec.ts:123:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "kz"
Received: null
```

# Page snapshot

```yaml
- generic [active] [ref=f2e1]:
  - main [ref=f2e2]:
    - generic [ref=f2e3]:
      - link "← отчёты" [ref=f2e4] [cursor=pointer]:
        - /url: /reports
      - link "Сводка дня" [ref=f2e5] [cursor=pointer]:
        - /url: "?form=day"
      - link "Список проживающих" [ref=f2e6] [cursor=pointer]:
        - /url: "?form=inhouse"
      - link "RU" [ref=f2e7] [cursor=pointer]:
        - /url: "?form=inhouse&lang=ru"
      - link "KZ" [ref=f2e8] [cursor=pointer]:
        - /url: "?form=inhouse&lang=kz"
      - button "Печать" [ref=f2e9] [cursor=pointer]
    - heading "Список проживающих" [level=1] [ref=f2e10]
    - generic [ref=f2e11]: "Средство размещения: Luxx Aparts; Дата: 05.10.2026"
    - 'heading "Проживают: 3" [level=2] [ref=f2e12]'
    - table [ref=f2e13]:
      - rowgroup [ref=f2e14]:
        - row [ref=f2e15]:
          - columnheader "Гость" [ref=f2e16]
          - columnheader "Категория" [ref=f2e17]
          - columnheader "Номер / место" [ref=f2e18]
          - columnheader "Заезд" [ref=f2e19]
          - columnheader "Выезд" [ref=f2e20]
          - columnheader "Гостей" [ref=f2e21]
      - rowgroup [ref=f2e22]:
        - row [ref=f2e23]:
          - cell "Гость Учебный" [ref=f2e24]
          - cell "Мужской общий номер" [ref=f2e25]
          - cell "M01" [ref=f2e26]
          - cell "03.10.2026" [ref=f2e27]
          - cell "08.10.2026" [ref=f2e28]
          - cell "1" [ref=f2e29]
        - row [ref=f2e30]:
          - cell "Посетитель Демо" [ref=f2e31]
          - cell "Мужской общий номер" [ref=f2e32]
          - cell "M02" [ref=f2e33]
          - cell "03.10.2026" [ref=f2e34]
          - cell "08.10.2026" [ref=f2e35]
          - cell "1" [ref=f2e36]
        - row [ref=f2e37]:
          - cell "Клиент Пример" [ref=f2e38]
          - cell "Женский общий номер" [ref=f2e39]
          - cell "F01" [ref=f2e40]
          - cell "03.10.2026" [ref=f2e41]
          - cell "08.10.2026" [ref=f2e42]
          - cell "1" [ref=f2e43]
    - generic [ref=f2e44]: "Сформировано: 2026-10-05 20:24"
  - alert [ref=f2e45]
```

# Test source

```ts
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
  98  |       await expect(method).toHaveValue('CASH');
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
> 130 |       expect(new URL(page.url()).searchParams.get('lang')).toBe('kz');
      |                                                            ^ Error: expect(received).toBe(expected) // Object.is equality
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