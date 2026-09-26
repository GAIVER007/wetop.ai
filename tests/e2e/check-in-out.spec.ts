import { expect, test } from './fixtures';
import { cardTab } from './card-tabs';
import { confirmDialog } from './confirm';
import { roomiestCategory } from './pick-category';

/** Срез 5, B1: заезд и выезд с карточки; незаезд снимает ячейку. Гость вымышленный, даты сегодня → завтра. */
const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
/*
 * Свой отрезок будущих суток. Два спека на одних ночях дерутся за одни и те же койки:
 * прогон в два воркера падал то на одном тесте, то на другом, а поодиночке был зелёным.
 * Карта отрезков — tests/README.md, раздел «Окна дат». Новый спек — новый отрезок.
 */
const BASE = 0;
const plus = (n: number) => {
  const x = new Date(`${today}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + BASE + n);
  return x.toISOString().slice(0, 10);
};

test('заселить → карточка и шахматка показывают «заселён» → выселить; незаезд освобождает ячейку', async ({
  page,
  request,
}) => {
  // сценарий длинный: бронь, карточка гостя, документ, заезд, шахматка, выезд, вторая бронь, незаезд
  test.setTimeout(240_000);
  await page.goto(`/reservations/new?arrival=${plus(3)}&departure=${plus(4)}`);
  const form = page.getByRole('main').getByTestId('new-reservation-form');
  await form.locator('select[name="source"]').selectOption('WALK_IN');
  await form
    .locator('select[name="accommodationTypeCode"]')
    .selectOption(await roomiestCategory(request, plus(3), plus(4)));
  const unitSelect = form.locator('select[name="unitCode"]');
  const unitCode = (await unitSelect.locator('option').nth(1).getAttribute('value'))!;
  await unitSelect.selectOption(unitCode);
  await form.locator('input[name="firstName"]').fill('Гость');
  await form.locator('input[name="lastName"]').fill('Тест-заезд');
  await form.locator('textarea[name="notes"]').fill('E2E-АВТОТЕСТ'); // сверка исключает автотесты
  await form.getByRole('button', { name: 'Создать бронь' }).click();
  await expect(page).toHaveURL(/\/reservations\/\d{8}-[A-Z0-9]{6}$/);
  const number = page.url().split('/').pop()!;
  // без гражданства заселение блокируется (DATA_MODEL §3, eQonaq)
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
  await expect(page.getByRole('alert').first()).toContainText('гражданство');
  await cardTab(page, 'Обзор');
  await page.getByRole('main').getByTestId('guest-link').click();
  await expect(page).toHaveURL(/\/guests\//);
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
  await expect(
    page.getByRole('main').getByTestId('guest-form').locator('input[name="citizenship"]'),
  ).toHaveValue('KAZ');
  const doc = page.getByRole('main').getByTestId('document-form');
  await doc.locator('input[name="number"]').fill('N 0000001');
  await doc.locator('input[name="issueCountry"]').fill('KAZ');
  await doc.getByRole('button', { name: 'Добавить' }).click();
  await expect(page.getByRole('main').getByTestId('document-row')).toContainText('****0001');
  await page.screenshot({ path: 'reports/screenshots/guest-card.png', fullPage: true });
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
  // статус читаем в строке проживания: слово встречается ещё и в заголовке брони. Сначала итог, потом вкладка:
  // заселение — серверное действие, и по его ответу карточка возвращает вкладку, где его выполнили (#… адреса
  // на старте действия), — щелчок по «Обзору» до ответа откатывался (упало 26.09.2026 в наборе на два потока)
  await expect(page.getByRole('main').getByTestId('stay-row').first()).toContainText('заселён');
  await cardTab(page, 'Обзор');
  await page.goto(`/chessboard?from=${plus(3)}&to=${plus(4)}`);
  const cell = page.locator(`td[data-state="OCCUPIED"] a[href*="${number}"]`).first();
  await expect(cell).toBeVisible();
  await page.screenshot({ path: 'reports/screenshots/check-in-chessboard.png' });
  await page.goto(`/reservations/${number}`);

  // T3: на счёте есть начисление за проживание и нет оплаты, значит выселение должно быть остановлено.
  // Окно «Выселить с долгом?» (срез 7.3) называет сумму; «Оставить» — проверяем именно защиту:
  // статус обязан остаться «заселён».
  await cardTab(page, 'Действия');
  await page.getByRole('main').locator('[data-testid^="check-out-"]').click();
  await expect(page.getByRole('main').getByTestId('debt-amount')).toContainText('Долг');
  await confirmDialog(page, 'Оставить');
  await cardTab(page, 'Обзор');
  await expect(page.getByRole('main').getByTestId('stay-row').first()).toContainText('заселён');
  await cardTab(page, 'Счета');
  await expect(page.getByRole('main').getByTestId('folio-balance')).toContainText('к оплате');

  // то же действие с подтверждением администратора — гость выселен, долг за ним остаётся
  await cardTab(page, 'Действия');
  await page.getByRole('main').locator('[data-testid^="check-out-"]').click();
  await confirmDialog(page, 'Выселить с долгом');
  // итог действия — до смены вкладки (см. заселение выше)
  await expect(page.getByRole('main').getByTestId('stay-row').first()).toContainText('выселен');
  await cardTab(page, 'Обзор');
  await cardTab(page, 'Счета');
  await expect(page.getByRole('main').getByTestId('folio-balance')).toContainText('к оплате');
  await page.screenshot({ path: 'reports/screenshots/check-out-card.png', fullPage: true });

  // незаезд
  await page.goto(`/reservations/new?arrival=${plus(5)}&departure=${plus(6)}`);
  const f2 = page.getByRole('main').getByTestId('new-reservation-form');
  await f2.locator('select[name="source"]').selectOption('PHONE');
  await f2
    .locator('select[name="accommodationTypeCode"]')
    .selectOption(await roomiestCategory(request, plus(5), plus(6)));
  const freeUnit = f2.locator('select[name="unitCode"]');
  await expect(freeUnit.locator('option')).not.toHaveCount(1); // есть хотя бы одна свободная койка
  await freeUnit.selectOption((await freeUnit.locator('option').nth(1).getAttribute('value'))!);
  await f2.locator('input[name="firstName"]').fill('Гость');
  await f2.locator('input[name="lastName"]').fill('Тест-незаезд');
  await f2.locator('textarea[name="notes"]').fill('E2E-АВТОТЕСТ'); // сверка исключает автотесты
  await f2.getByRole('button', { name: 'Создать бронь' }).click();
  await expect(page).toHaveURL(/\/reservations\/\d{8}-[A-Z0-9]{6}$/);
  await cardTab(page, 'Действия');
  await page.getByRole('main').locator('[data-testid^="no-show-"]').click();
  await confirmDialog(page, 'Отметить незаезд');
  // статус читаем в строке проживания: слово «Незаезд» есть ещё и на кнопке; итог — до смены вкладки
  await expect(page.getByRole('main').getByTestId('stay-row').first()).toContainText('незаезд');
  await cardTab(page, 'Обзор');
  // §14: пустое значение — прочерк; ячейка снята, в колонке «—»
  await expect(
    page.getByRole('main').getByTestId('stay-row').first().locator('td').first(),
  ).toHaveText('—');
});
