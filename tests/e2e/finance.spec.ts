import { expect, test } from './fixtures';
import { cardTab } from './card-tabs';
import { roomiestCategory } from './pick-category';

/**
 * Финансы (DATA_MODEL §6, ADR-014): счёт создаётся вместе с проживанием, начисление = цене;
 * штраф и услуга добавляются с карточки, оплата по умолчанию на весь баланс, возврат из платежа,
 * сторно ручного начисления; начисление за проживание руками не сторнируется.
 */
const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
/*
 * Свой отрезок будущих суток. Два спека на одних ночях дерутся за одни и те же койки:
 * прогон в два воркера падал то на одном тесте, то на другом, а поодиночке был зелёным.
 * Карта отрезков — tests/README.md, раздел «Окна дат». Новый спек — новый отрезок.
 */
const BASE = 9;
const plus = (n: number) => {
  const x = new Date(`${today}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + BASE + n);
  return x.toISOString().slice(0, 10);
};
/** «12 000,00 ₸ · к оплате» → 1200000n; «−500,00 ₸» → −50000n */
const minor = (text: string) => BigInt(text.replace(/[^\d−-]/g, '').replace('−', '-'));
const decimal = (m: bigint) => {
  const d = (m < 0n ? -m : m).toString().padStart(3, '0');
  return `${m < 0n ? '-' : ''}${d.slice(0, -2)}.${d.slice(-2)}`;
};

test('счёт на проживание: начисления, оплата, возврат и сторно сходятся в баланс', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await page.goto(`/reservations/new?arrival=${plus(9)}&departure=${plus(10)}`);
  const form = page.getByRole('main').getByTestId('new-reservation-form');
  await form.locator('select[name="source"]').selectOption('WALK_IN');
  await form
    .locator('select[name="accommodationTypeCode"]')
    .selectOption(await roomiestCategory(request, plus(9), plus(10)));
  await form.locator('input[name="firstName"]').fill('Гость');
  await form.locator('input[name="lastName"]').fill('Тест-счёт');
  await form.locator('textarea[name="notes"]').fill('E2E-АВТОТЕСТ'); // сверка исключает автотесты
  await form.getByRole('button', { name: 'Создать бронь' }).click();
  await expect(page).toHaveURL(/\/reservations\/\d{8}-[A-Z0-9]{6}$/);

  const panel = page.getByTestId('folio-panel');
  await expect(panel).toHaveCount(1);
  const price = minor(await page.getByTestId('stay-row').first().locator('td').nth(5).innerText());
  // счёт и его формы — на вкладке «Счета»; каждое чтение баланса открывает её, как администратор
  const balance = async () => {
    await cardTab(page, 'Счета');
    return minor(await page.getByTestId('folio-balance').innerText());
  };
  expect(price).toBeGreaterThan(0n);
  expect(await balance()).toBe(price); // начисление за проживание = цене проживания
  await expect(panel.getByTestId('charge-row')).toHaveCount(1);
  await expect(panel.getByTestId('charge-row').first()).toHaveAttribute(
    'data-kind',
    'ACCOMMODATION',
  );
  await expect(panel.getByTestId('charge-row').first().locator('button')).toHaveCount(0); // сторно проживания нет

  // штраф 1 000 ₸
  let cf = panel.getByTestId('charge-form');
  await cf.locator('select[name="kind"]').selectOption('PENALTY');
  await cf.locator('input[name="description"]').fill('Поздний выезд');
  await cf.locator('input[name="unitPrice"]').fill('1000');
  await cf.getByRole('button', { name: 'Начислить' }).click();
  await expect(panel.getByTestId('charge-row')).toHaveCount(2);
  expect(await balance()).toBe(price + 100_000n);

  // услуга из справочника × 2 (стирка 500 ₸)
  cf = panel.getByTestId('charge-form');
  await cf.locator('select[name="kind"]').selectOption('SERVICE');
  await cf.locator('select[name="serviceCode"]').selectOption('Стирка (1 загрузка)');
  await cf.locator('input[name="quantity"]').fill('2');
  await cf.getByRole('button', { name: 'Начислить' }).click();
  await expect(panel.getByTestId('charge-row')).toHaveCount(3);
  await expect(panel.getByTestId('charge-row').nth(2)).toContainText('2 × 500,00 ₸');
  expect(await balance()).toBe(price + 200_000n);

  // оплата наличными: сумма по умолчанию — весь баланс
  const pf = panel.getByTestId('payment-form');
  await expect(pf.locator('input[name="amount"]')).toHaveValue(decimal(price + 200_000n));
  await pf.getByRole('button', { name: 'Принять оплату' }).click();
  await expect(panel.getByTestId('payment-row')).toHaveCount(1);
  expect(await balance()).toBe(0n);
  await expect(page.getByTestId('folio-balance')).toContainText('оплачено');

  // возврат 500 ₸ из этого платежа
  const rf = panel.getByTestId('refund-form');
  await rf.locator('input[name="amount"]').fill('500');
  await rf.locator('input[name="reason"]').fill('ранний выезд');
  await rf.getByRole('button', { name: 'вернуть' }).click();
  await expect(panel.getByText(/Возвраты:/)).toBeVisible();
  expect(await balance()).toBe(50_000n);

  // сторно штрафа → переплата 500 ₸
  const penalty = panel.getByTestId('charge-row').filter({ hasText: 'Поздний выезд' });
  await penalty.getByRole('button', { name: 'сторно' }).click();
  await expect(penalty).toContainText('сторнировано');
  expect(await balance()).toBe(-50_000n);
  await expect(page.getByTestId('folio-balance')).toContainText('переплата');
  await page.screenshot({ path: 'reports/screenshots/finance-card.png', fullPage: true });

  // журнал: действия записаны без ПД
  await page.goto('/journal');
  await expect(page.getByText('finance.payment').first()).toBeVisible();
  await expect(page.getByText('finance.refund').first()).toBeVisible();
});
