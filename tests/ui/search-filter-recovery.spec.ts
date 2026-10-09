import { FIXTURE_API, expect, test, settleStreaming } from './fixtures';
import { mkdirSync } from 'node:fs';

// Synthetic loopback API. UI state evidence, not production or database evidence.
const arrival = '2026-10-10';
const departure = '2026-10-12';
const search = `/rooms/availability?arrival=${arrival}&departure=${departure}&guests=2`;
const evidence = 'reports/search-filter-qa-2026-10-05/evidence';
let browserErrors: string[] = [];

test.beforeEach(async ({ request, page }) => {
  browserErrors = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  await request.post(`${FIXTURE_API}/__test/reset`);
});
test.afterEach(() => expect(browserErrors).toEqual([]));

for (const width of [1440, 390]) {
  test.describe(`search/filter recovery ${width}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
    });

    for (const preset of ['Завтра', 'Выходные']) {
      test(`availability: ${preset} updates edited fields and repeated search`, async ({
        page,
      }) => {
        await page.goto(search);
        await page.getByLabel('Заезд', { exact: true }).fill('2026-10-13');
        await page.getByLabel('Выезд', { exact: true }).fill('2026-10-15');
        const link = page.getByRole('link', { name: preset, exact: true });
        const target = new URL((await link.getAttribute('href'))!, page.url());
        await link.click();
        await expect(page).toHaveURL(target.href);
        await expect(page.getByLabel('Заезд', { exact: true })).toHaveValue(
          target.searchParams.get('arrival')!,
        );
        await expect(page.getByLabel('Выезд', { exact: true })).toHaveValue(
          target.searchParams.get('departure')!,
        );
        await page.getByRole('button', { name: 'Найти', exact: true }).click();
        await expect(page).toHaveURL(target.href);
      });
    }

    test('availability: manual dates and guests do not apply before Find', async ({ page }) => {
      await page.goto(search);
      await page.getByLabel('Заезд', { exact: true }).fill('2026-10-13');
      await page.getByLabel('Выезд', { exact: true }).fill('2026-10-16');
      await page.getByLabel('Гостей', { exact: true }).fill('3');
      await expect(page.getByLabel('Заезд', { exact: true })).toHaveValue('2026-10-13');
      await expect(page.getByLabel('Выезд', { exact: true })).toHaveValue('2026-10-16');
      await expect(page.getByLabel('Гостей', { exact: true })).toHaveValue('3');
      await expect(page).toHaveURL(new URL(search, page.url()).href);
      await expect(page.locator('.fund-result-heading')).toContainText('2 ночи');
      await expect(page.locator('.fund-result-heading')).toContainText('2 гостя');
      await page.getByRole('button', { name: 'Найти', exact: true }).click();
      await expect(page).toHaveURL(/arrival=2026-10-13&departure=2026-10-16&guests=3/);
      await expect(page.locator('.fund-result-heading')).toContainText('3 ночи');
      await expect(page.locator('.fund-result-heading')).toContainText('3 гостя');
    });

    test('availability: selected guests and category survive a quick period and booking link', async ({
      page,
    }) => {
      await page.goto(search);
      await page.getByRole('combobox', { name: 'Категория', exact: true }).selectOption('MALE');
      await page.getByLabel('Гостей', { exact: true }).fill('3');
      const weekend = page.getByRole('link', { name: 'Выходные', exact: true });
      await expect(weekend).toHaveAttribute('href', /guests=3&category=MALE/);
      const weekendUrl = new URL((await weekend.getAttribute('href'))!, page.url()).href;
      await weekend.click();
      await expect(page).toHaveURL(weekendUrl);
      expect(new URL(page.url()).searchParams.get('guests')).toBe('3');
      expect(new URL(page.url()).searchParams.get('category')).toBe('MALE');
      await expect(page.getByRole('combobox', { name: 'Категория', exact: true })).toHaveValue(
        'MALE',
      );
      const applied = new URL(page.url()).searchParams;
      await page.locator('.fund-availability summary').first().click();
      const book = page.locator('.fund-availability a[href^="/reservations/new"]').first();
      await expect(book).toBeVisible();
      const target = new URL((await book.getAttribute('href'))!, page.url()).searchParams;
      expect(target.get('arrival')).toBe(applied.get('arrival'));
      expect(target.get('departure')).toBe(applied.get('departure'));
      expect(target.get('category')).toBe('MALE');
      mkdirSync(evidence, { recursive: true });
      await page.screenshot({ path: `${evidence}/search-${width}.png`, fullPage: true });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
    });

    test('availability: category action transfers category into search', async ({ page }) => {
      await page.goto('/rooms/categories');
      await page
        .getByRole('button', { name: 'Действия с категорией Мужской общий номер', exact: true })
        .click();
      await page.getByRole('menuitem', { name: 'Свободные места', exact: true }).click();
      await expect(page.getByRole('combobox', { name: 'Категория', exact: true })).toHaveValue(
        'MALE',
      );
      expect(new URL(page.url()).searchParams.get('category')).toBe('MALE');
    });

    test('availability: manual input is a draft until Find; category survives reload and history', async ({
      page,
    }) => {
      await page.goto(`${search}&category=MALE`);
      const category = page.getByRole('combobox', { name: 'Категория', exact: true });
      await expect(category).toHaveValue('MALE');
      await page.getByLabel('Заезд', { exact: true }).fill('2026-10-13');
      await page.getByLabel('Выезд', { exact: true }).fill('2026-10-16');
      await page.getByLabel('Гостей', { exact: true }).fill('3');
      await expect(page).toHaveURL(
        new RegExp(`arrival=${arrival}&departure=${departure}&guests=2&category=MALE`),
      );
      await expect(page.getByLabel('Заезд', { exact: true })).toHaveValue('2026-10-13');
      await expect(page.locator('.fund-result-heading')).toContainText('2 ночи');
      await page.getByRole('button', { name: 'Найти', exact: true }).click();
      await expect(page).toHaveURL(/arrival=2026-10-13&departure=2026-10-16&guests=3/);
      expect(new URL(page.url()).searchParams.get('category')).toBe('MALE');
      await page.reload();
      await expect(category).toHaveValue('MALE');
      await expect(page.getByLabel('Заезд', { exact: true })).toHaveValue('2026-10-13');
      await page.goBack();
      await expect(page.getByLabel('Заезд', { exact: true })).toHaveValue(arrival);
      await page.goForward();
      await expect(page.getByLabel('Выезд', { exact: true })).toHaveValue('2026-10-16');
      await expect(category).toHaveValue('MALE');
    });

    test('availability: calendar transfers its inclusive range and category', async ({ page }) => {
      await page.goto('/chessboard?from=2026-10-10&to=2026-10-12&category=MALE');
      const link = page.getByRole('link', { name: 'Поиск свободных номеров', exact: true });
      if (width === 390) {
        // The existing mobile calendar hides this desktop header action. Verify its destination,
        // then the actual mobile search, without forcing clicks on hidden controls.
        await page.goto((await link.getAttribute('href'))!);
      } else await link.click();
      await expect(page.getByLabel('Заезд', { exact: true })).toHaveValue('2026-10-10');
      await expect(page.getByLabel('Выезд', { exact: true })).toHaveValue('2026-10-13');
      await expect(page.getByRole('combobox', { name: 'Категория', exact: true })).toHaveValue(
        'MALE',
      );
    });

    test('finance: empty refunds keep method and resetting it preserves other filters', async ({
      page,
    }) => {
      const url =
        '/finance?from=2026-10-05&to=2026-10-05&op=refund&method=CASH&src=cash#operations';
      await page.goto(url);
      await expect(page.getByTestId('ops-empty')).toBeVisible();
      const method = page.getByRole('combobox', { name: 'Способ оплаты', exact: true });
      await expect(method).toBeVisible();
      await expect(method).toHaveValue('CASH');
      await page.reload();
      await expect(method).toHaveValue('CASH');
      await method.selectOption('');
      await page.getByRole('button', { name: 'Показать', exact: true }).click();
      const q = new URL(page.url()).searchParams;
      expect(q.get('method')).toBe('');
      expect(q.get('op')).toBe('refund');
      expect(q.get('src')).toBe('cash');
      expect(q.get('from')).toBe('2026-10-05');
      expect(q.get('to')).toBe('2026-10-05');
      await page.goBack();
      await expect(method).toHaveValue('CASH');
      await page.goForward();
      await expect(method).toHaveValue('');
    });

    test('print: KZ and RU survive form changes, reload and history', async ({ page }) => {
      await page.goto('/reports/print?form=day&date=2026-10-05');
      await page.getByRole('link', { name: 'KZ', exact: true }).click();
      await settleStreaming(page);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Күн бойынша жиынтық');
      await page.getByRole('link', { name: 'Список проживающих', exact: true }).click();
      await settleStreaming(page);
      expect(new URL(page.url()).searchParams.get('lang')).toBe('kz');
      expect(new URL(page.url()).searchParams.get('date')).toBe('2026-10-05');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Тұрып жатқан қонақтар тізімі',
      );
      await page.reload();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Тұрып жатқан қонақтар тізімі',
      );
      await page.goBack();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Күн бойынша жиынтық');
      await page.goForward();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Тұрып жатқан қонақтар тізімі',
      );
      await page.getByRole('link', { name: 'Сводка дня', exact: true }).click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Күн бойынша жиынтық');
      await page.getByRole('link', { name: 'RU', exact: true }).click();
      await page.getByRole('link', { name: 'Список проживающих', exact: true }).click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Список проживающих');
      expect(new URL(page.url()).searchParams.get('lang')).toBe('ru');
      await page.reload();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Список проживающих');
    });
  });
}
