# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: search-filter-recovery.spec.ts >> search/filter recovery 390 >> rates: empty row is rejected, zero nights and false restrictions remain changes
- Location: tests/ui/search-filter-recovery.spec.ts:103:5

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByTestId('bulk-editor').getByRole('alert')
Expected substring: "Укажите хотя бы одно изменение"
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" getByTestId('bulk-editor').getByRole('alert') with timeout 15000ms
  - waiting for getByTestId('bulk-editor').getByRole('alert')

```

```yaml
- link "К содержимому":
  - /url: "#main-content"
- banner:
  - button "Открыть меню"
  - link "WETOP, Главная":
    - /url: /today
    - text: W
  - button "Найти гостя или бронь"
  - button "Переключить тему"
  - button "Меню администратора": АД
- main:
  - heading "Тарифы и цены" [level=1]
  - navigation "Действия страницы":
    - button "Изменить цены"
    - dialog "Изменить цены и ограничения":
      - heading "Изменить цены и ограничения" [level=2]
      - 'button "Закрыть: Изменить цены и ограничения"'
      - text: Категория
      - combobox "Категория":
        - option "Двухместный номер" [selected]
        - option "Мужской общий номер"
        - option "Женский общий номер"
      - text: Тариф
      - combobox "Тариф":
        - option "Стандартный" [selected]
      - text: С даты
      - textbox "С даты": 2026-10-01
      - text: По дату
      - textbox "По дату": 2026-10-31
      - paragraph: Не сопоставлено с менеджером каналов — изменение в каналы не уйдёт.
      - group "Дни недели":
        - text: Дни недели
        - checkbox "пн" [checked]
        - text: пн
        - checkbox "вт" [checked]
        - text: вт
        - checkbox "ср" [checked]
        - text: ср
        - checkbox "чт" [checked]
        - text: чт
        - checkbox "пт" [checked]
        - text: пт
        - checkbox "сб" [checked]
        - text: сб
        - checkbox "вс" [checked]
        - text: вс
      - text: Цена за ночь
      - textbox "Цена за ночь":
        - /placeholder: напр. 15400
      - text: Гостей (occupancy)
      - spinbutton "Гостей (occupancy)"
      - text: Мин. ночей
      - spinbutton "Мин. ночей"
      - text: Макс. ночей
      - spinbutton "Макс. ночей"
      - text: Стоп-продажа
      - combobox "Стоп-продажа":
        - option "не менять" [selected]
        - option "да"
        - option "нет"
      - text: Закрыт заезд (CTA)
      - combobox "Закрыт заезд (CTA)":
        - option "не менять" [selected]
        - option "да"
        - option "нет"
      - text: Закрыт выезд (CTD)
      - combobox "Закрыт выезд (CTD)":
        - option "не менять" [selected]
        - option "да"
        - option "нет"
      - button "+ Добавить в список"
      - list:
        - listitem:
          - text: "Двухместный номер, Стандартный: 01.10 → 31.10.2026 —"
          - button "Убрать строку 1": ×
      - button "Сохранить 1 изменение"
  - navigation "Тарифы и цены":
    - link "Цены":
      - /url: /rates
    - link "Тарифные планы":
      - /url: /rates/plans
    - link "Промокоды":
      - /url: /rates/promo
  - text: Категория
  - combobox "Категория":
    - option "Двухместный номер" [selected]
    - option "Мужской общий номер"
    - option "Женский общий номер"
  - text: Тариф
  - combobox "Тариф":
    - option "Стандартный (KZT)" [selected]
  - group "Месяц календаря":
    - link "Предыдущий месяц":
      - /url: /rates?category=ROOM&ratePlan=BASE&month=2026-09
    - combobox "Месяц":
      - option "октябрь 2025"
      - option "ноябрь 2025"
      - option "декабрь 2025"
      - option "январь 2026"
      - option "февраль 2026"
      - option "март 2026"
      - option "апрель 2026"
      - option "май 2026"
      - option "июнь 2026"
      - option "июль 2026"
      - option "август 2026"
      - option "сентябрь 2026"
      - option "октябрь 2026" [selected]
      - option "ноябрь 2026"
      - option "декабрь 2026"
      - option "январь 2027"
      - option "февраль 2027"
      - option "март 2027"
      - option "апрель 2027"
      - option "май 2027"
      - option "июнь 2027"
      - option "июль 2027"
      - option "август 2027"
      - option "сентябрь 2027"
      - option "октябрь 2027"
      - option "ноябрь 2027"
      - option "декабрь 2027"
      - option "январь 2028"
      - option "февраль 2028"
      - option "март 2028"
      - option "апрель 2028"
      - option "май 2028"
      - option "июнь 2028"
      - option "июль 2028"
      - option "август 2028"
      - option "сентябрь 2028"
      - option "октябрь 2028"
    - link "Следующий месяц":
      - /url: /rates?category=ROOM&ratePlan=BASE&month=2026-11
    - link "Сегодня":
      - /url: /rates?category=ROOM&ratePlan=BASE
  - paragraph: Выберите дату или отрезок в календаре, чтобы изменить цены
  - list:
    - listitem:
      - button "Выбрать 1 окт. чт":
        - time: 1 окт. чт
      - text: 2 гостя
      - button "Изменить цену на 2026-10-01, гостей 2": 10 000 ₸
      - text: 1 гость
      - button "Изменить цену на 2026-10-01, гостей 1": 8 000 ₸
    - listitem:
      - button "Выбрать 2 окт. пт":
        - time: 2 окт. пт
      - text: 2 гостя
      - button "Изменить цену на 2026-10-02, гостей 2": 10 000 ₸
      - text: 1 гость
      - button "Изменить цену на 2026-10-02, гостей 1": 8 000 ₸
    - listitem:
      - button "Выбрать 3 окт. сб":
        - time: 3 окт. сб
      - text: 2 гостя
      - button "Изменить цену на 2026-10-03, гостей 2": 10 000 ₸
      - text: 1 гость
      - button "Изменить цену на 2026-10-03, гостей 1": 8 000 ₸
    - listitem:
      - button "Выбрать 4 окт. вс":
        - time: 4 окт. вс
      - text: 2 гостя
      - button "Изменить цену на 2026-10-04, гостей 2": 10 000 ₸
      - text: 1 гость
      - button "Изменить цену на 2026-10-04, гостей 1": 8 000 ₸
    - listitem:
      - button "Выбрать 5 окт. пн":
        - time: 5 окт. пн
      - text: 2 гостя
      - button "Изменить цену на 2026-10-05, гостей 2": 10 000 ₸
      - text: 1 гость
      - button "Изменить цену на 2026-10-05, гостей 1": 8 000 ₸
    - listitem:
      - button "Выбрать 6 окт. вт":
        - time: 6 окт. вт
      - text: 2 гостя
      - button "Изменить цену на 2026-10-06, гостей 2": 10 000 ₸
      - text: 1 гость
      - button "Изменить цену на 2026-10-06, гостей 1": 8 000 ₸
    - listitem:
      - button "Выбрать 7 окт. ср":
        - time: 7 окт. ср
      - text: 2 гостя
      - button "Изменить цену на 2026-10-07, гостей 2": 10 000 ₸
      - text: 1 гость
      - button "Изменить цену на 2026-10-07, гостей 1": 8 000 ₸
    - listitem:
      - button "Выбрать 8 окт. чт":
        - time: 8 окт. чт
      - text: 2 гостя
      - button "Изменить цену на 2026-10-08, гостей 2": 10 000 ₸
      - text: 1 гость
      - button "Изменить цену на 2026-10-08, гостей 1": 8 000 ₸
    - listitem:
      - button "Выбрать 9 окт. пт":
        - time: 9 окт. пт
      - text: 2 гостя
      - button "Изменить цену на 2026-10-09, гостей 2": 10 000 ₸
      - text: 1 гость
      - button "Изменить цену на 2026-10-09, гостей 1": 8 000 ₸
    - listitem:
      - button "Выбрать 10 окт. сб":
        - time: 10 окт. сб
      - text: 2 гостя
      - button "Изменить цену на 2026-10-10, гостей 2": 10 000 ₸
      - text: 1 гость
      - button "Изменить цену на 2026-10-10, гостей 1": 8 000 ₸
    - listitem:
      - button "Выбрать 11 окт. вс":
        - time: 11 окт. вс
      - text: 2 гостя
      - button "Изменить цену на 2026-10-11, гостей 2": 10 000 ₸
      - text: 1 гость
      - button "Изменить цену на 2026-10-11, гостей 1": 8 000 ₸
    - listitem:
      - button "Выбрать 12 окт. пн":
        - time: 12 окт. пн
      - text: 2 гостя
      - button "Изменить цену на 2026-10-12, гостей 2": 10 000 ₸
      - text: 1 гость
      - button "Изменить цену на 2026-10-12, гостей 1": 8 000 ₸
    - listitem:
      - button "Выбрать 13 окт. вт":
        - time: 13 окт. вт
      - text: 2 гостя
      - button "Изменить цену на 2026-10-13, гостей 2": 10 000 ₸
      - text: 1 гость
      - button "Изменить цену на 2026-10-13, гостей 1": 8 000 ₸
    - listitem:
      - button "Выбрать 14 окт. ср":
        - time: 14 окт. ср
      - text: 2 гостя
      - button "Изменить цену на 2026-10-14, гостей 2": 10 000 ₸
      - text: 1 гость
      - button "Изменить цену на 2026-10-14, гостей 1": 8 000 ₸
    - listitem:
      - button "Выбрать 15 окт. чт":
        - time: 15 окт. чт
      - text: 2 гостя
      - button "Изменить цену на 2026-10-15, гостей 2": 10 000 ₸
      - text: 1 гость
      - button "Изменить цену на 2026-10-15, гостей 1": 8 000 ₸
    - listitem:
      - button "Выбрать 16 окт. пт":
        - time: 16 окт. пт
      - text: 2 гостя
      - button "Изменить цену на 2026-10-16, гостей 2": 10 000 ₸
      - text: 1 гость
      - button "Изменить цену на 2026-10-16, гостей 1": 8 000 ₸
    - listitem:
      - button "Выбрать 17 окт. сб":
        - time: 17 окт. сб
      - text: 2 гостя
      - button "Изменить цену на 2026-10-17, гостей 2": 10 000 ₸
      - text: 1 гость
      - button "Изменить цену на 2026-10-17, гостей 1": 8 000 ₸
    - listitem:
      - button "Выбрать 18 окт. вс":
        - time: 18 окт. вс
      - text: 2 гостя
      - button "Изменить цену на 2026-10-18, гостей 2": 10 000 ₸
      - text: 1 гость
      - button "Изменить цену на 2026-10-18, гостей 1": 8 000 ₸
    - listitem:
      - button "Выбрать 19 окт. пн":
        - time: 19 окт. пн
      - text: 2 гостя
      - button "Изменить цену на 2026-10-19, гостей 2": 10 000 ₸
      - text: 1 гость
      - button "Изменить цену на 2026-10-19, гостей 1": 8 000 ₸
    - listitem:
      - button "Выбрать 20 окт. вт":
        - time: 20 окт. вт
      - text: 2 гостя
      - button "Изменить цену на 2026-10-20, гостей 2": 10 000 ₸
      - text: 1 гость
      - button "Изменить цену на 2026-10-20, гостей 1": 8 000 ₸
    - listitem:
      - button "Выбрать 21 окт. ср":
        - time: 21 окт. ср
      - text: 2 гостя
      - button "Изменить цену на 2026-10-21, гостей 2": 10 000 ₸
      - text: 1 гость
      - button "Изменить цену на 2026-10-21, гостей 1": 8 000 ₸
    - listitem:
      - button "Выбрать 22 окт. чт":
        - time: 22 окт. чт
      - text: 2 гостя
      - button "Изменить цену на 2026-10-22, гостей 2": 10 000 ₸
      - text: 1 гость
      - button "Изменить цену на 2026-10-22, гостей 1": 8 000 ₸
    - listitem:
      - button "Выбрать 23 окт. пт":
        - time: 23 окт. пт
      - text: 2 гостя
      - button "Изменить цену на 2026-10-23, гостей 2": 10 000 ₸
      - text: 1 гость
      - button "Изменить цену на 2026-10-23, гостей 1": 8 000 ₸
    - listitem:
      - button "Выбрать 24 окт. сб":
        - time: 24 окт. сб
      - text: 2 гостя
      - button "Изменить цену на 2026-10-24, гостей 2": 10 000 ₸
      - text: 1 гость
      - button "Изменить цену на 2026-10-24, гостей 1": 8 000 ₸
    - listitem:
      - button "Выбрать 25 окт. вс":
        - time: 25 окт. вс
      - text: 2 гостя
      - button "Изменить цену на 2026-10-25, гостей 2": 10 000 ₸
      - text: 1 гость
      - button "Изменить цену на 2026-10-25, гостей 1": 8 000 ₸
    - listitem:
      - button "Выбрать 26 окт. пн":
        - time: 26 окт. пн
      - text: 2 гостя
      - button "Изменить цену на 2026-10-26, гостей 2": 10 000 ₸
      - text: 1 гость
      - button "Изменить цену на 2026-10-26, гостей 1": 8 000 ₸
    - listitem:
      - button "Выбрать 27 окт. вт":
        - time: 27 окт. вт
      - text: 2 гостя
      - button "Изменить цену на 2026-10-27, гостей 2": 10 000 ₸
      - text: 1 гость
      - button "Изменить цену на 2026-10-27, гостей 1": 8 000 ₸
    - listitem:
      - button "Выбрать 28 окт. ср":
        - time: 28 окт. ср
      - text: 2 гостя
      - button "Изменить цену на 2026-10-28, гостей 2": 10 000 ₸
      - text: 1 гость
      - button "Изменить цену на 2026-10-28, гостей 1": 8 000 ₸
    - listitem:
      - button "Выбрать 29 окт. чт":
        - time: 29 окт. чт
      - text: 2 гостя
      - button "Изменить цену на 2026-10-29, гостей 2": 10 000 ₸
      - text: 1 гость
      - button "Изменить цену на 2026-10-29, гостей 1": 8 000 ₸
    - listitem:
      - button "Выбрать 30 окт. пт":
        - time: 30 окт. пт
      - text: 2 гостя
      - button "Изменить цену на 2026-10-30, гостей 2": 10 000 ₸
      - text: 1 гость
      - button "Изменить цену на 2026-10-30, гостей 1": 8 000 ₸
    - listitem:
      - button "Выбрать 31 окт. сб":
        - time: 31 окт. сб
      - text: 2 гостя
      - button "Изменить цену на 2026-10-31, гостей 2": 10 000 ₸
      - text: 1 гость
      - button "Изменить цену на 2026-10-31, гостей 1": 8 000 ₸
- navigation "Основная навигация":
  - link "Главная":
    - /url: /today
  - link "Календарь":
    - /url: /chessboard
  - link "Брони":
    - /url: /reservations
  - link "Гости":
    - /url: /guests
  - button "Ещё разделы": Ещё
- alert
```

# Test source

```ts
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
> 111 |       await expect(editor.getByRole('alert')).toContainText('Укажите хотя бы одно изменение');
      |                                               ^ Error: expect(locator).toContainText(expected) failed
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