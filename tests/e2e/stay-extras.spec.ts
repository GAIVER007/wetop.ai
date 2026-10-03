import { expect, test } from './fixtures';
import { unitOption } from './unit-options';
import { cardTab } from './card-tabs';
import { confirmDialog } from './confirm';
import { roomiestCategory } from './pick-category';

/**
 * ADR-021: ранний заезд и поздний выезд — платные услуги на счёте одной кнопкой, половина цены ночи
 * по умолчанию. Гость вымышленный, бронь помечена для уборки.
 */
const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
/*
 * Свой отрезок будущих суток. Два спека на одних ночях дерутся за одни и те же койки:
 * прогон в два воркера падал то на одном тесте, то на другом, а поодиночке был зелёным.
 * Карта отрезков — tests/README.md, раздел «Окна дат». Новый спек — новый отрезок.
 */
const BASE = 10;
const plus = (n: number) => {
  const x = new Date(`${today}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + BASE + n);
  return x.toISOString().slice(0, 10);
};
const money = (s: string) => Number(s.replace(/[^\d,]/g, '').replace(',', '.'));

test('поздний выезд и ранний заезд начисляются на счёт как половина ночи', async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  await page.goto(`/reservations/new?arrival=${plus(12)}&departure=${plus(14)}`);
  const form = page.getByRole('main').getByTestId('new-reservation-form');
  // источник и заметки с 02.10 под свёрнутым «Дополнительно» (booking-compact); open — без переключения
  await form.locator('details:has(select[name="source"])').evaluate((d) => {
    (d as HTMLDetailsElement).open = true;
  });
  await form.locator('select[name="source"]').selectOption('WALK_IN');
  await form
    .locator('select[name="accommodationTypeCode"]')
    .selectOption(await roomiestCategory(request, plus(12), plus(14)));
  const unit = await unitOption(form.locator('select[name="unitCode"]'));
  await form.locator('select[name="unitCode"]').selectOption(unit);
  await form.locator('input[name="firstName"]').fill('Гость');
  await form.locator('input[name="lastName"]').fill('Тест-поздний-выезд');
  await form.locator('textarea[name="notes"]').fill('E2E-АВТОТЕСТ'); // сверка исключает автотесты
  await form.getByRole('button', { name: 'Создать бронь' }).click();
  await expect(page).toHaveURL(/\/reservations\/\d{8}-[A-Z0-9]{6}$/);

  // цена двух ночей — из строки проживания; половина ночи = цена / 2 / 2
  const price = money(
    await page.getByRole('main').getByTestId('stay-row').first().locator('td').nth(5).innerText(),
  );
  const half = Math.floor(price / 2 / 2);

  // диалог спрашивает время: 19:00 → вся ночь по правилу объекта из Legacy
  page.once('dialog', (d) => void d.accept('19:00'));
  await cardTab(page, 'Счета');
  await page.getByRole('main').locator('[data-testid^="late-check-out-"]').click();
  const late = page
    .getByRole('main')
    .getByTestId('charge-row')
    .filter({ hasText: 'Поздний выезд' });
  await expect(late).toHaveCount(1);
  expect(money(await late.locator('td').nth(3).innerText())).toBe(half * 2);
  // услуга датирована днём выезда: сырая дата — в datetime, человек видит «14 окт.» (§14, D3)
  await expect(late.locator('time').first()).toHaveAttribute('datetime', plus(14));

  page.once('dialog', (d) => void d.accept('07:00')); // 06:00–11:59 → половина ночи
  await page.getByRole('main').locator('[data-testid^="early-check-in-"]').click();
  const early = page
    .getByRole('main')
    .getByTestId('charge-row')
    .filter({ hasText: 'Ранний заезд' });
  await expect(early).toHaveCount(1);
  await expect(early.locator('time').first()).toHaveAttribute('datetime', plus(12));

  // баланс вырос на целую ночь (выезд в 19:00) и половину (заезд в 07:00)
  expect(money(await page.getByRole('main').getByTestId('folio-balance').innerText())).toBe(
    price + 3 * half,
  );

  // соседние ночи на этой койке заблокированы, как «выделять доступность» в Legacy
  const number = page.url().split('/').pop()!;
  await page.goto(`/chessboard?from=${plus(11)}&to=${plus(14)}`);
  const unitRow = page
    .getByRole('main')
    .locator(`[data-testid="unit-row"][data-unit-code="${unit}"]`);
  await expect(unitRow.locator(`td[data-date="${plus(11)}"][data-state="BLOCKED"]`)).toHaveCount(1);
  await expect(unitRow.locator(`td[data-date="${plus(14)}"][data-state="BLOCKED"]`)).toHaveCount(1);
  await page.goto(`/reservations/${number}`);

  await cardTab(page, 'Действия');
  await page.getByRole('main').getByTestId('cancel-reservation').click();
  await confirmDialog(page, 'Отменить бронь');
  await cardTab(page, 'Обзор');
  await expect(page.getByRole('main').getByTestId('stay-row').first()).toContainText('отменена');
  // отмена брони снимает и её блоки соседних ночей — койка снова продаётся
  await page.goto(`/chessboard?from=${plus(11)}&to=${plus(14)}`);
  await expect(unitRow.locator('td[data-state="BLOCKED"]')).toHaveCount(0);
});
