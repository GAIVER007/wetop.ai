import { expect, test } from './fixtures';
import { minorFromText } from './money';
import { cardTab } from './card-tabs';
import { confirmDialog } from './confirm';
import { ratePlanWithPenalty, roomiestCategory } from './pick-category';
import { unitCodes } from './pick-unit';

/**
 * Q-103: отмена сторнирует начисление за проживание и ставит штраф по политике тарифа
 * (умолчание — правило Legacy «стоимость первых суток»); штраф стойка может сторнировать.
 * Гость вымышленный (ADR-010).
 */
const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
/*
 * Свой отрезок будущих суток. Два спека на одних ночях дерутся за одни и те же койки:
 * прогон в два воркера падал то на одном тесте, то на другом, а поодиночке был зелёным.
 * Карта отрезков — tests/README.md, раздел «Окна дат». Новый спек — новый отрезок.
 */
const BASE = 28;
const plus = (n: number) => {
  const x = new Date(`${today}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + BASE + n);
  return x.toISOString().slice(0, 10);
};
const minor = minorFromText;

test('отмена заранее — без штрафа, незаезд — со штрафом за первую ночь, стойка может его снять', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await page.goto(`/reservations/new?arrival=${plus(20)}&departure=${plus(23)}`);
  const form = page.getByRole('main').getByTestId('new-reservation-form');
  await form.locator('select[name="source"]').selectOption('PHONE');
  await form
    .locator('select[name="accommodationTypeCode"]')
    .selectOption(await roomiestCategory(request, plus(20), plus(23)));
  await form.locator('input[name="firstName"]').fill('Гость');
  await form.locator('input[name="lastName"]').fill('Тест-штраф');
  await form.locator('textarea[name="notes"]').fill('E2E-АВТОТЕСТ'); // сверка исключает автотесты
  await form.getByRole('button', { name: 'Создать бронь' }).click();
  await expect(page).toHaveURL(/\/reservations\/\d{8}-[A-Z0-9]{6}$/);

  const panel = page.getByRole('main').getByTestId('folio-panel');
  const stayTotal = minor(
    await page.getByRole('main').getByTestId('stay-row').first().locator('td').nth(5).innerText(),
  );
  const balance = async () => {
    await cardTab(page, 'Счета');
    return minor(await page.getByRole('main').getByTestId('folio-balance').innerText());
  };
  expect(await balance()).toBe(stayTotal);

  // Отмена задолго до заезда: по правилу объекта (Q-103) штрафа нет, начисление просто сторнируется.
  // Окно подтверждения (срез 7.3, Д5) говорит об этом до нажатия — тем же кодом, что потом пишет счёт
  await cardTab(page, 'Действия');
  await page.getByRole('main').getByTestId('cancel-reservation').click();
  await confirmDialog(page, 'Отменить бронь', /Штраф не начисляется/);
  await expect(page.getByText('отменена').first()).toBeVisible();
  await cardTab(page, 'Счета');
  const accommodation = panel.getByTestId('charge-row').filter({ hasText: 'проживание' }).first();
  await expect(accommodation).toContainText('сторнировано');
  await expect(panel.getByTestId('charge-row').filter({ hasText: 'Штраф' })).toHaveCount(0);
  expect(await balance()).toBe(0n);

  // Незаезд: штраф есть всегда, потому что место простояло
  await page.goto(`/reservations/new?arrival=${plus(21)}&departure=${plus(24)}`);
  const f2 = page.getByRole('main').getByTestId('new-reservation-form');
  await f2.locator('select[name="source"]').selectOption('PHONE');
  await f2
    .locator('select[name="accommodationTypeCode"]')
    .selectOption(await roomiestCategory(request, plus(21), plus(24)));
  // тариф со штрафом в первую ночь — по политике, а не по коду объекта (Q-103)
  await f2
    .locator('select[name="ratePlanCode"]')
    .selectOption(await ratePlanWithPenalty(request, 'FIRST_NIGHT'));
  const unit = f2.locator('select[name="unitCode"]');
  await unit.selectOption((await unitCodes(unit))[0]!);
  await f2.locator('input[name="firstName"]').fill('Гость');
  await f2.locator('input[name="lastName"]').fill('Тест-незаезд-штраф');
  await f2.locator('textarea[name="notes"]').fill('E2E-АВТОТЕСТ'); // сверка исключает автотесты
  await f2.getByRole('button', { name: 'Создать бронь' }).click();
  await expect(page).toHaveURL(/\/reservations\/\d{8}-[A-Z0-9]{6}$/);
  const stay2 = minor(
    await page.getByRole('main').getByTestId('stay-row').first().locator('td').nth(5).innerText(),
  );
  await cardTab(page, 'Действия');
  await page.getByRole('main').locator('[data-testid^="no-show-"]').click();
  // сумма в окне = сумма начисления: предпросмотр и штраф считает одна функция (Д5)
  await expect(page.getByRole('main').getByTestId('no-show-penalty')).toContainText(
    'останется на счёте',
  ); // предпросмотр дошёл
  const shownText = await page.getByRole('main').getByTestId('no-show-penalty').innerText();
  const shown = minor(shownText); // общий помощник уже переводит и целые тенге, и тиыны
  await confirmDialog(page, 'Отметить незаезд', /Штраф .* останется на счёте/);
  await expect(page.getByText('незаезд').first()).toBeVisible();
  await cardTab(page, 'Счета');
  const penalty = page
    .getByRole('main')
    .getByTestId('folio-panel')
    .getByTestId('charge-row')
    .filter({ hasText: 'Штраф за незаезд' });
  await expect(penalty).toHaveCount(1);
  const penaltyMinor = minor(await penalty.locator('td').nth(3).innerText());
  expect(penaltyMinor * 3n).toBe(stay2); // одна ночь из трёх
  expect(shown).toBe(penaltyMinor); // окно показало ровно то, что легло на счёт
  expect(await balance()).toBe(penaltyMinor);
  await page.screenshot({ path: 'reports/screenshots/cancellation-penalty.png', fullPage: true });

  // стойка решила не взыскивать — сторнирует штраф, баланс обнуляется
  await penalty.getByRole('button', { name: 'сторно' }).click();
  await expect(penalty).toContainText('сторнировано');
  expect(await balance()).toBe(0n);
});
