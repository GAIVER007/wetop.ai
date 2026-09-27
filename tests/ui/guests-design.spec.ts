import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * «Гости v2» (27.09.2026, ТЗ владельца; план plans/guests-v2-2026-09-27.md).
 *
 * Прежний экран показывал брони на сегодня и подписывал гостя статусом брони («отменена») — то самое
 * смешение сущностей, которое ТЗ называет главной проблемой (§3, §15). Здесь проверяется новый
 * справочник: одна строка — один человек; разделы-чипы со счётчиками до нажатия; состояние гостя —
 * вычисленное слово («живёт», «ожидается», «выехал недавно»), а не статус брони; компактный
 * автопоиск без кнопки «Найти»; пустые состояния словами.
 */
const fixture = 'http://127.0.0.1:4311';

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${fixture}/__test/control`, { data: {} });
});

test('гости: одна строка — один гость, разделы-чипы со счётчиками, состояние — слово о госте', async ({
  page,
}) => {
  const main = page.getByRole('main');
  await page.goto('/guests');
  // 9 гостей фикстуры: 4 живут, 4 ожидаются (включая просроченный заезд TEST8), 1 выехал сегодня
  await expect(main.getByTestId('guests-meta')).toContainText('9 гостей');
  await expect(main.getByTestId('guests-table').locator('tbody tr')).toHaveCount(9);

  const chips = main.getByRole('navigation', { name: 'Гости по состоянию' });
  await expect(chips).toHaveClass(/chips/);
  for (const [label, count] of [
    ['Все', '9'],
    ['Проживают', '4'],
    ['Ожидаются', '4'],
    ['Недавние', '1'],
  ] as const) {
    await expect(chips.getByRole('link', { name: `${label} ${count}` })).toBeVisible();
  }
  // слово о госте, не статус брони: «Завершены» и «Проживают» из словаря броней в строках нет
  await expect(main.getByTestId('guests-table')).toContainText('живёт');
  await expect(main.getByTestId('guests-table')).toContainText('ожидается');
  await expect(main.getByText('Завершены', { exact: true })).toHaveCount(0);

  // раздел фильтрует и назван в выборке; бейджи строк совпадают с разделом
  await page.goto('/guests?state=inhouse');
  await expect(main.getByTestId('guests-meta')).toContainText('4 гостя, проживают');
  await expect(main.getByTestId('guests-table').locator('tbody tr')).toHaveCount(4);
  await expect(main.getByTestId('guests-table')).not.toContainText('ожидается');

  // старый адрес со статусом брони живёт в закладках — читается как раздел
  await page.goto('/guests?status=CHECKED_OUT');
  await expect(main.getByTestId('guests-meta')).toContainText('выехали за 30 дней');
  await expect(main.getByTestId('guests-table')).toContainText('выехал недавно');

  // строка ведёт в карточку человека, а колонка «Сейчас» показывает ячейку живущего
  await page.goto('/guests?state=inhouse');
  const row = main.getByTestId('guest-row').first();
  await expect(row.locator('.dir-unit')).toBeVisible();
  const chipHeight = await chips
    .getByRole('link', { name: /Проживают/ })
    .evaluate((el) => el.getBoundingClientRect().height);
  expect(chipHeight).toBeGreaterThanOrEqual(38);
});

test('гости: кейсы владельца — несколько проживаний, только отменённая бронь, давний выезд', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/guest-cases`);
  const main = page.getByRole('main');
  await page.goto('/guests');
  await expect(main.getByTestId('guests-table').locator('tbody tr')).toHaveCount(13);

  // три брони одного человека — одна строка: живёт, «Визитов 3», последний визит заполнен
  const returning = main.getByTestId('guest-row').filter({ hasText: 'Возвращающийся' });
  await expect(returning).toHaveCount(1);
  await expect(returning).toContainText('живёт');
  await expect(returning.locator('td').nth(4)).toHaveText(/(визитов )?3/);
  await expect(returning.locator('td').nth(3).locator('time')).toHaveCount(2);

  // только отменённая бронь — это статус брони, не человека: «—» и подпись словами (ТЗ §16)
  const cancelled = main.getByTestId('guest-row').filter({ hasText: 'Отменившийся' });
  await expect(cancelled).toContainText('бронь на');
  await expect(cancelled).toContainText('отменена');
  await expect(cancelled.locator('.badge')).toHaveCount(0);

  // выехал 40 дней назад: активного проживания нет и «Недавние» его не считают
  await expect(main.getByTestId('guest-row').filter({ hasText: 'Давний' })).toContainText('—');
  const chips = main.getByRole('navigation', { name: 'Гости по состоянию' });
  await expect(chips.getByRole('link', { name: 'Недавние 1' })).toBeVisible();
  await expect(chips.getByRole('link', { name: 'Проживают 6' })).toBeVisible();
});

test('гости: панель предпросмотра — сейчас, история и долг из счетов, переходы и Escape (G3)', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/guest-cases`);
  const main = page.getByRole('main');
  await page.goto('/guests');

  // живущий должник: где живёт, долг словом и суммой, «Открыть бронь» ведёт на его бронь
  await main.getByRole('link', { name: /Задолжавший/ }).click();
  const drawer = page.getByRole('dialog', { name: 'Гость', exact: true });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByTestId('guest-preview-now')).toContainText('живёт');
  await expect(drawer.getByTestId('guest-preview-now')).toContainText('R11');
  await expect(drawer.getByTestId('guest-preview-finance')).toContainText('к оплате');
  await expect(drawer.getByTestId('guest-preview-finance')).toContainText('4 000 ₸');
  await expect(drawer.getByRole('link', { name: 'Открыть бронь', exact: true })).toHaveAttribute(
    'href',
    /\/reservations\/20260916-GCDEBT0/,
  );
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
  // Escape закрывает панель и возвращает список
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(page).toHaveURL(/\/guests$/);

  // история одного человека: три визита, восемь ночей
  await main.getByRole('link', { name: /Возвращающийся/ }).click();
  const history = drawer.getByTestId('guest-preview-history');
  await expect(history).toContainText('Визитов');
  await expect(history).toContainText('3');
  await expect(history).toContainText('Ночей');
  await expect(history).toContainText('8');
  await page.keyboard.press('Escape');

  // только отменённая бронь: счетов нет, подпись называет бронь, не человека
  await main.getByRole('link', { name: /Отменившийся/ }).click();
  await expect(drawer.getByTestId('guest-preview-finance')).toContainText('Счетов пока нет');
  await expect(drawer.getByTestId('guest-preview-now')).toContainText('отменена');
  await expect(drawer.getByRole('link', { name: 'Открыть бронь', exact: true })).toHaveCount(0);

  // «Открыть гостя» — полная карточка с документами и историей
  await drawer.getByRole('link', { name: 'Открыть гостя', exact: true }).click();
  await expect(page).toHaveURL(/\/guests\/ui-guest-GCCAN0$/);
  await expect(main.getByTestId('guest-head')).toBeVisible();
});

test('гости: автопоиск без кнопки «Найти», имя — ссылка, пустые состояния словами', async ({
  page,
  request,
}) => {
  const main = page.getByRole('main');
  await page.goto('/guests');
  // компактный поиск: поле с подсказкой, кнопки «Найти» больше нет (ТЗ §6, §48)
  const input = main.getByLabel('Поиск гостей');
  expect((await input.boundingBox())!.width).toBeGreaterThanOrEqual(280);
  await expect(main.getByRole('button', { name: 'Найти', exact: true })).toHaveCount(0);
  await input.fill('Демо');
  await page.waitForURL(/\/guests\?q=%D0%94%D0%B5%D0%BC%D0%BE|\/guests\?q=Демо/);
  await expect(main.getByTestId('guests-meta')).toContainText('по запросу «Демо»');
  await expect(main.getByTestId('guests-table').locator('tbody tr')).toHaveCount(2);

  // имя гостя отличается от обычного текста: ссылка подчёркивается под курсором и в фокусе
  const guest = main.getByTestId('guests-table').getByRole('link').first();
  await guest.hover();
  await expect(guest).toHaveCSS('text-decoration-line', 'underline');
  // имя читается от левого края ячейки: старый класс `.directory-guest` центрировал его (21.09)
  const offset = await guest.evaluate(
    (el) => el.getBoundingClientRect().left - el.closest('td')!.getBoundingClientRect().left,
  );
  expect(offset, 'имя гостя не прижато к левому краю ячейки').toBeLessThanOrEqual(16);

  // пустой результат отбора: что пусто и что сделать, шапки таблицы над пустотой нет
  await page.goto('/guests?q=Нетакого');
  await expect(main.getByTestId('guests-empty')).toContainText('Ничего не найдено');
  await expect(main.getByTestId('guests-table')).toHaveCount(0);
  await expect(main.getByRole('columnheader')).toHaveCount(0);

  // пустая база: гостей нет вовсе — свой текст и путь к первой брони (ТЗ §42)
  await request.post(`${fixture}/__test/control`, { data: { noBookings: true } });
  await page.goto('/guests');
  await expect(main.getByTestId('guests-none')).toContainText('Гостей пока нет');
  await expect(main.getByTestId('guests-none').getByRole('link', { name: 'Новая бронь' }))
    .toBeVisible();

  const audit = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
});
