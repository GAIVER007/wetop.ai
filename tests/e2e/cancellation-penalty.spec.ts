import { expect, test } from '@playwright/test';
import { cardTab } from './card-tabs';

/**
 * Q-103: отмена сторнирует начисление за проживание и ставит штраф по политике тарифа
 * (умолчание — правило Exely «стоимость первых суток»); штраф стойка может сторнировать.
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
const minor = (text: string) => BigInt(text.replace(/[^\d−-]/g, '').replace('−', '-'));

test('отмена заранее — без штрафа, незаезд — со штрафом за первую ночь, стойка может его снять', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto(`/reservations/new?arrival=${plus(20)}&departure=${plus(23)}`);
  const form = page.getByTestId('new-reservation-form');
  await form.locator('select[name="source"]').selectOption('PHONE');
  await form.locator('select[name="accommodationTypeCode"]').selectOption('exely-5074688');
  await form.locator('input[name="firstName"]').fill('Гость');
  await form.locator('input[name="lastName"]').fill('Тест-штраф');
  await form.locator('textarea[name="notes"]').fill('E2E-АВТОТЕСТ'); // сверка исключает автотесты
  await form.getByRole('button', { name: 'Создать бронь' }).click();
  await expect(page).toHaveURL(/\/reservations\/\d{8}-[A-Z0-9]{6}$/);

  const panel = page.getByTestId('folio-panel');
  const stayTotal = minor(
    await page.getByTestId('stay-row').first().locator('td').nth(5).innerText(),
  );
  const balance = async () => {
    await cardTab(page, 'Счета');
    return minor(await page.getByTestId('folio-balance').innerText());
  };
  expect(await balance()).toBe(stayTotal);

  page.on('dialog', (d) => d.accept());
  // Отмена задолго до заезда: по правилу объекта (Q-103) штрафа нет, начисление просто сторнируется
  await cardTab(page, 'Действия');
  await page.getByTestId('cancel-reservation').click();
  await expect(page.getByText('отменена').first()).toBeVisible();
  await cardTab(page, 'Счета');
  const accommodation = panel.getByTestId('charge-row').filter({ hasText: 'проживание' }).first();
  await expect(accommodation).toContainText('сторнировано');
  await expect(panel.getByTestId('charge-row').filter({ hasText: 'Штраф' })).toHaveCount(0);
  expect(await balance()).toBe(0n);

  // Незаезд: штраф есть всегда, потому что место простояло
  await page.goto(`/reservations/new?arrival=${plus(21)}&departure=${plus(24)}`);
  const f2 = page.getByTestId('new-reservation-form');
  await f2.locator('select[name="source"]').selectOption('PHONE');
  await f2.locator('select[name="accommodationTypeCode"]').selectOption('exely-5074688');
  await f2.locator('select[name="ratePlanCode"]').selectOption('exely-10158310'); // тариф ОТА: штраф — первая ночь
  const unit = f2.locator('select[name="unitCode"]');
  await unit.selectOption((await unit.locator('option').nth(1).getAttribute('value'))!);
  await f2.locator('input[name="firstName"]').fill('Гость');
  await f2.locator('input[name="lastName"]').fill('Тест-незаезд-штраф');
  await f2.locator('textarea[name="notes"]').fill('E2E-АВТОТЕСТ'); // сверка исключает автотесты
  await f2.getByRole('button', { name: 'Создать бронь' }).click();
  await expect(page).toHaveURL(/\/reservations\/\d{8}-[A-Z0-9]{6}$/);
  const stay2 = minor(await page.getByTestId('stay-row').first().locator('td').nth(5).innerText());
  await cardTab(page, 'Действия');
  await page.locator('[data-testid^="no-show-"]').click();
  await expect(page.getByText('незаезд').first()).toBeVisible();
  await cardTab(page, 'Счета');
  const penalty = page
    .getByTestId('folio-panel')
    .getByTestId('charge-row')
    .filter({ hasText: 'Штраф за незаезд' });
  await expect(penalty).toHaveCount(1);
  const penaltyMinor = minor(await penalty.locator('td').nth(3).innerText());
  expect(penaltyMinor * 3n).toBe(stay2); // одна ночь из трёх
  expect(await balance()).toBe(penaltyMinor);
  await page.screenshot({ path: 'reports/screenshots/cancellation-penalty.png', fullPage: true });

  // стойка решила не взыскивать — сторнирует штраф, баланс обнуляется
  await penalty.getByRole('button', { name: 'сторно' }).click();
  await expect(penalty).toContainText('сторнировано');
  expect(await balance()).toBe(0n);
});
