import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Поле даты с календарём (21.09.2026, поручение владельца: «выбор даты удобнее»).
 *
 * Было: родной календарь браузера — в тёмной теме чужой чёрный блок с «Удалить / Сегодня»,
 * без отрезка «с … по», без стиля стойки. Стало: родное поле остаётся (ввод с клавиатуры, `fill()`
 * в тестах), а кнопка справа открывает наш месяц: стрелки, Enter, Escape, отрезок от парного поля.
 */
const fixture = 'http://127.0.0.1:4311';

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

const field = (page: import('@playwright/test').Page, label: string) =>
  page.getByRole('main').locator('.date-field', { has: page.getByLabel(label, { exact: true }) });

test('главная: календарь открывается кнопкой, ходит стрелками, Enter ставит дату, Escape закрывает', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/today?period=custom&from=2026-09-01&to=2026-09-21');
  const from = field(page, 'Период: с');
  const open = from.getByRole('button', { name: 'Открыть календарь' });
  await open.click();
  const dialog = page.getByRole('dialog', { name: 'Календарь' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('сентябрь 2026');
  // фокус — на выбранном дне; вправо на день и Enter
  await expect(dialog.getByRole('button', { name: '1 сентября 2026', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('button', { name: '2 сентября 2026', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Период: с', { exact: true })).toHaveValue('2026-09-09');
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();
  // Escape закрывает без выбора
  await open.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel('Период: с', { exact: true })).toHaveValue('2026-09-09');
  // родное поле по-прежнему принимает ввод (на этом стоят прежние тесты)
  await page.getByLabel('Период: с', { exact: true }).fill('2026-09-03');
  await expect(page.getByLabel('Период: с', { exact: true })).toHaveValue('2026-09-03');
});

test('главная: у поля «По» календарь показывает отрезок от «С», сегодня отмечено, без нарушений доступности', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/today?period=custom&from=2026-09-10&to=2026-09-21');
  const to = field(page, 'Период: по');
  await to.getByRole('button', { name: 'Открыть календарь' }).click();
  const dialog = page.getByRole('dialog', { name: 'Календарь' });
  await expect(dialog).toBeVisible();
  // отрезок 10 → 21 сентября — 12 дней подсвечены
  await expect(dialog.locator('.date-field__day.is-range')).toHaveCount(12);
  // сегодня отмечено ровно один день (какой — зависит от часов объекта в момент прогона)
  await expect(dialog.locator('.date-field__day[aria-current="date"]')).toHaveCount(1);
  // календарь целиком на экране, хотя поле стоит у правого края планки
  const box = await dialog.boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(1440);
  const axe = await new AxeBuilder({ page }).include('.date-field__pop').analyze();
  expect(axe.violations, JSON.stringify(axe.violations, null, 1)).toEqual([]);
  // ‹ › листают месяц
  await dialog.getByRole('button', { name: 'Предыдущий месяц' }).click();
  await expect(dialog).toContainText('август 2026');
});

test('телефон: кнопки календаря нет, родное поле остаётся', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/today?period=custom&from=2026-09-01&to=2026-09-21');
  const from = field(page, 'Период: с');
  await expect(from.getByRole('button', { name: 'Открыть календарь' })).toBeHidden();
  await expect(page.getByLabel('Период: с', { exact: true })).toBeVisible();
});

test('панель брони: календарь открывается поверх панели, целиком на экране, и пишет дату в поле', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/chessboard');
  await page.getByTestId('stay-cell').first().dblclick();
  const drawer = page.getByRole('dialog', { name: 'Бронирование', exact: true });
  await expect(drawer).toBeVisible();
  await drawer.getByRole('tab', { name: 'Действия', exact: true }).click();
  const departure = drawer.locator('.date-field', {
    has: page.locator('input[name="departureDate"]'),
  });
  // имя поля для программы чтения — только слово подписи, без «Открыть календарь»
  await expect(drawer.getByLabel('Выезд', { exact: true })).toHaveAttribute(
    'name',
    'departureDate',
  );
  await departure.getByRole('button', { name: 'Открыть календарь' }).click();
  const calendar = page.getByRole('dialog', { name: 'Календарь' });
  await expect(calendar).toBeVisible();
  // целиком в окне — панель прокручивается, а календарь стоит в координатах окна
  const box = (await calendar.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(1440);
  expect(box.y + box.height).toBeLessThanOrEqual(1000);
  // не обрезан и не перекрыт: точка в его центре принадлежит календарю
  const hit = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.closest('.date-field__pop') !== null,
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );
  expect(hit, 'календарь обрезан прокруткой панели или перекрыт').toBe(true);
  // Escape закрывает календарь, а не панель
  await page.keyboard.press('Escape');
  await expect(calendar).toBeHidden();
  await expect(drawer).toBeVisible();
  await departure.getByRole('button', { name: 'Открыть календарь' }).click();
  await expect(calendar).toBeVisible();
  // выбор дня пишет дату в поле панели: день после выезда
  const before = await drawer.locator('input[name="departureDate"]').inputValue();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(calendar).toBeHidden();
  const after = await drawer.locator('input[name="departureDate"]').inputValue();
  expect(Date.parse(after) - Date.parse(before)).toBe(86_400_000);
});
