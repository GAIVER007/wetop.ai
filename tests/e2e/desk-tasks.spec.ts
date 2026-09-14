import { expect, test } from '@playwright/test';
import { cardTab } from './card-tabs';

/**
 * Задачи стойки T1, T2 и овербукинг из интерфейса (plans/plan-2026-09-10-desk-tasks.md).
 * Гости вымышленные (ADR-010). Проверяется то, что видит администратор, а не сервис под ним:
 *  — две формы, открытые одновременно, не могут посадить двух гостей на одну койку;
 *  — «+ 1 ночь» добавляет ровно одну ночь и ровно её цену;
 *  — переселение в другую категорию пересчитывает проживание по календарю новой категории.
 */
const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
/*
 * Свой отрезок будущих суток. Два спека на одних ночях дерутся за одни и те же койки:
 * прогон в два воркера падал то на одном тесте, то на другом, а поодиночке был зелёным.
 * Карта отрезков — tests/README.md, раздел «Окна дат». Новый спек — новый отрезок.
 */
const BASE = 6;
const plus = (n: number) => {
  const x = new Date(`${today}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + BASE + n);
  return x.toISOString().slice(0, 10);
};
const DORM = 'exely-5074688';
const money = (s: string) => Number(s.replace(/[^\d,]/g, '').replace(',', '.'));

test('стойка: занятую койку не продать дважды, «+ 1 ночь» и переселение с пересчётом', async ({
  page,
  context,
}) => {
  test.setTimeout(240_000);
  const arrival = plus(7);
  const departure = plus(9); // две ночи: продление на третью не должно пересчитать всё проживание

  // ── Овербукинг из интерфейса: две вкладки видят одну и ту же свободную койку ──────────────
  const url = `/reservations/new?arrival=${arrival}&departure=${departure}`;
  await page.goto(url);
  const second = await context.newPage();
  await second.goto(url);

  const fill = async (p: typeof page, lastName: string, unitCode: string) => {
    const f = p.getByTestId('new-reservation-form');
    await f.locator('select[name="source"]').selectOption('WALK_IN');
    await f.locator('select[name="accommodationTypeCode"]').selectOption(DORM);
    await f.locator('select[name="unitCode"]').selectOption(unitCode);
    await f.locator('input[name="firstName"]').fill('Гость');
    await f.locator('input[name="lastName"]').fill(lastName);
    await f.locator('textarea[name="notes"]').fill('E2E-АВТОТЕСТ'); // сверка исключает автотесты
    await f.getByRole('button', { name: 'Создать бронь' }).click();
  };

  const firstForm = page.getByTestId('new-reservation-form');
  await firstForm.locator('select[name="accommodationTypeCode"]').selectOption(DORM);
  const unit = (await firstForm
    .locator('select[name="unitCode"] option')
    .nth(1)
    .getAttribute('value'))!;
  // вторая вкладка выбирает ту же койку: её список составлен до создания первой брони
  const secondForm = second.getByTestId('new-reservation-form');
  await secondForm.locator('select[name="accommodationTypeCode"]').selectOption(DORM);
  await expect(secondForm.locator(`select[name="unitCode"] option[value="${unit}"]`)).toHaveCount(
    1,
  );

  await fill(page, 'Тест-первый', unit);
  await expect(page).toHaveURL(/\/reservations\/\d{8}-[A-Z0-9]{6}$/);

  await fill(second, 'Тест-второй', unit);
  // администратор обязан увидеть внятный отказ, а не белый экран и не вторую бронь на той же койке
  const refusal = second.getByRole('alert').first();
  await expect(refusal).toContainText(/занят|пересек/i);
  // в сообщении номер койки, а не внутренний идентификатор — иначе оно бесполезно на стойке
  await expect(refusal).toContainText(unit);
  await expect(refusal).not.toContainText(/[0-9a-f]{8}-[0-9a-f]{4}-/);
  await expect(second).toHaveURL(/\/reservations\/new/);
  // введённое не стёрлось: администратор меняет одну ячейку, а не набирает всё заново
  await expect(secondForm.locator('input[name="lastName"]')).toHaveValue('Тест-второй');
  await expect(secondForm.locator('select[name="accommodationTypeCode"]')).toHaveValue(DORM);
  await second.screenshot({ path: 'reports/screenshots/overbooking-refused.png', fullPage: true });
  await second.close();

  // ── T2: «+ 1 ночь» ───────────────────────────────────────────────────────────────────────
  const row = page.getByTestId('stay-row').first();
  await expect(row).toContainText(departure);
  const priceBefore = money(await row.locator('td').nth(5).innerText());
  await cardTab(page, 'Действия');
  await page.locator('[data-testid^="extend-"]').click();
  await cardTab(page, 'Обзор');
  await expect(row).toContainText(plus(10));
  const priceAfter = money(await row.locator('td').nth(5).innerText());
  // добавлена ровно одна ночь к двум: цена выросла примерно на половину, а не пересчиталась целиком
  expect(priceAfter).toBeGreaterThan(priceBefore);
  expect(priceAfter).toBeLessThan(priceBefore * 1.75);
  // счёт за проживание переписан под новую цену — долг администратору виден сразу
  await cardTab(page, 'Счета');
  expect(money(await page.getByTestId('folio-balance').innerText())).toBe(priceAfter);
  // форма изменения дат показывает новую дату выезда: иначе «Пересчитать и сохранить» молча
  // вернуло бы проживание на ночь назад
  await cardTab(page, 'Действия');
  await expect(page.locator('input[name="departureDate"]')).toHaveValue(plus(10));

  // ── T1: переселение в другую категорию с пересчётом ───────────────────────────────────────
  const assign = page.getByTestId('assign-form');
  const other = assign.locator('optgroup[label*="пересчётом"]').first();
  await expect(other).toHaveCount(1);
  const otherUnit = (await other.locator('option').first().getAttribute('value'))!;
  const otherCategory = (await other.getAttribute('label'))!.replace(' — с пересчётом цены', '');
  await assign.locator('select[name="unitCode"]').selectOption(otherUnit);
  await assign.getByRole('button', { name: 'Переселить' }).click();

  await cardTab(page, 'Обзор');
  await expect(row).toContainText(otherUnit);
  await expect(row).toContainText(otherCategory);
  const priceMoved = money(await row.locator('td').nth(5).innerText());
  expect(priceMoved).not.toBe(priceAfter); // цена взята из календаря новой категории
  await cardTab(page, 'Счета');
  expect(money(await page.getByTestId('folio-balance').innerText())).toBe(priceMoved);
  await page.screenshot({ path: 'reports/screenshots/desk-move-extend.png', fullPage: true });

  // прибрать за собой: бронь отменяется, койки освобождаются
  page.once('dialog', (d) => d.accept());
  await cardTab(page, 'Действия');
  await page.getByTestId('cancel-reservation').click();
  await cardTab(page, 'Обзор');
  await expect(page.getByTestId('stay-row').first()).toContainText('отменена');
});
