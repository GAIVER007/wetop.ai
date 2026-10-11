import { expect, test } from './fixtures';
import { unitOption } from './unit-options';
import { minorFromText } from './money';
import { cardTab } from './card-tabs';
import { roomiestCategory } from './pick-category';

/**
 * Срез 5 целиком одной цепочкой: «сутки можно прожить руками».
 * Бронь → гражданство и документ → заезд → услуга на счёт → оплата → выезд без долга → счёт закрыт,
 * ячейка свободна. Гость вымышленный (ADR-010).
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

test('сутки гостя целиком: заезд, услуга на счёт, оплата, выезд — счёт сходится', async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const arrival = plus(26);
  const departure = plus(27);

  // 1. Бронь с ячейкой
  await page.goto(`/reservations/new?arrival=${arrival}&departure=${departure}`);
  const form = page.getByRole('main').getByTestId('new-reservation-form');
  // источник и заметки с 02.10 под свёрнутым «Дополнительно» (booking-compact); open — без переключения
  await form.locator('details:has(select[name="source"])').evaluate((d) => {
    (d as HTMLDetailsElement).open = true;
  });
  await form.locator('select[name="source"]').selectOption('WALK_IN');
  await form
    .locator('select[name="accommodationTypeCode"]')
    .selectOption(await roomiestCategory(request, arrival, departure));
  const unitSelect = form.locator('select[name="unitCode"]');
  const unitCode = await unitOption(unitSelect);
  await unitSelect.selectOption(unitCode);
  await form.locator('input[name="firstName"]').fill('Гость');
  await form.locator('input[name="lastName"]').fill('Тест-сутки');
  await form.locator('textarea[name="notes"]').fill('E2E-АВТОТЕСТ'); // сверка исключает автотесты
  await form.getByRole('button', { name: 'Создать бронь' }).click();
  await expect(page).toHaveURL(/\/reservations\/\d{8}-[A-Z0-9]{6}$/);
  const number = page.url().split('/').pop()!;
  const stayPrice = minor(
    await page.getByRole('main').getByTestId('stay-row').first().locator('td').nth(5).innerText(),
  );
  const balance = async () => {
    await cardTab(page, 'Счета');
    return minor(await page.getByRole('main').getByTestId('folio-balance').innerText());
  };
  expect(await balance()).toBe(stayPrice);

  // 2. Гость: гражданство и документ — без них заселение запрещено
  await cardTab(page, 'Обзор');
  await page.getByRole('main').getByTestId('guest-link').click();
  // G4: карточка гостя открывается «Обзором»; профиль и документы — за «Редактировать»
  await page.getByRole('main').getByRole('link', { name: 'Редактировать', exact: true }).click();
  await page
    .getByRole('main')
    .getByTestId('guest-form')
    .locator('input[name="citizenship"]')
    .fill('KAZ');
  await page
    .getByRole('main')
    .getByTestId('guest-form')
    .getByRole('button', { name: 'Сохранить' })
    .click();
  // G5: документы — своя вкладка карточки гостя
  await page.getByRole('main').getByRole('tab', { name: 'Документы', exact: true }).click();
  const doc = page.getByRole('main').getByTestId('document-form');
  await doc.locator('input[name="number"]').fill('N 0000777');
  await doc.locator('input[name="issueCountry"]').fill('KAZ');
  await doc.getByRole('button', { name: 'Добавить' }).click();
  await expect(page.getByRole('main').getByTestId('document-row')).toContainText('****0777');

  // 3. Заезд
  await page.goto(`/reservations/${number}`);
  await cardTab(page, 'Действия');
  await page.getByRole('main').locator('[data-testid^="check-in-"]').click();
  {
    // Q-156 (ADR-068): на живом сиде ячейки не проверены — стойка предупреждает, заселяем после подтверждения
    const warn = page.getByRole('dialog', { name: /ещё не проверена/ });
    if (
      await warn.waitFor({ state: 'visible', timeout: 3000 }).then(
        () => true,
        () => false,
      )
    )
      await warn.getByRole('button', { name: 'Заселить всё равно' }).click();
  }
  await cardTab(page, 'Обзор');
  await expect(page.getByRole('main').getByTestId('stay-row').first()).toContainText('Проживает');

  // 4. Услуга на счёт
  const panel = page.getByRole('main').getByTestId('folio-panel');
  const charge = panel.getByTestId('charge-form');
  await cardTab(page, 'Счета');
  await charge.locator('select[name="kind"]').selectOption('SERVICE');
  await charge.locator('select[name="serviceCode"]').selectOption('Стирка (1 загрузка)');
  await charge.getByRole('button', { name: 'Начислить' }).click();
  await expect(panel.getByTestId('charge-row')).toHaveCount(2);
  const withService = await balance();
  expect(withService).toBe(stayPrice + 50_000n);

  // 5. Оплата на весь баланс
  const pay = panel.getByTestId('payment-form');
  await pay.locator('select[name="method"]').selectOption('KASPI');
  await pay.getByRole('button', { name: 'Принять оплату' }).click();
  await expect(panel.getByTestId('payment-row')).toHaveCount(1);
  expect(await balance()).toBe(0n);

  // 6. Выезд: долга нет, подтверждения не спрашивают
  await cardTab(page, 'Действия');
  await page.getByRole('main').locator('[data-testid^="check-out-"]').click();
  await cardTab(page, 'Обзор');
  await expect(page.getByRole('main').getByTestId('stay-row').first()).toContainText('Выехал');
  expect(await balance()).toBe(0n);
  await page.screenshot({ path: 'reports/screenshots/full-day.png', fullPage: true });

  // 7. Счёт закрыт по существу: начисления не сторнированы, оплата их покрывает, долга нет.
  // Ячейку выселение не освобождает: ночь проживания состоялась и остаётся за гостем —
  // освобождение при РАННЕМ выезде проверяется отдельно в check-in-out.spec.ts.
  await expect(panel.getByTestId('charge-row')).toHaveCount(2);
  await expect(panel.getByTestId('charge-row').first()).not.toContainText('сторнировано');
  const paid = minor(await panel.getByTestId('payment-row').locator('td').nth(2).innerText());
  expect(paid).toBe(withService);
  await expect(page.getByRole('main').getByTestId('folio-balance')).toContainText('оплачено');
  // счёт закрыт и это подписано: иначе администратор видит счёт без форм и не понимает почему
  await expect(page.getByRole('main').getByTestId('folio-closed')).toContainText('счёт закрыт');
});
