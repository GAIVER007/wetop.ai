import { FIXTURE_API, expect, test } from './fixtures';
import { cardTab } from '../e2e/card-tabs';

/**
 * Отзыв гостя гостиницы после выезда (HOTEL-REVIEWS-20261031), единая система с салоном: до выезда кнопки нет;
 * после выезда стойка создаёт ссылку, гость без входа ставит оценку и комментарий, отзыв виден в карточке брони.
 * Стенд: бронь 20260913-TESTAA (R01, три ночи).
 */
const BOOKING = '20260913-TESTAA';

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

test('ссылка на отзыв после выезда, гость оценивает, отзыв в карточке', async ({ page, browser }) => {
  await page.goto(`/reservations/${BOOKING}`);
  await cardTab(page, 'Счета');
  await expect(page.getByTestId('stay-review-issue')).toHaveCount(0);

  await cardTab(page, 'Действия');
  await page.getByRole('main').getByTestId('check-in-ui-item').click();
  await page.getByRole('dialog', { name: 'Номер R01 ещё не проверен. Заселить?' }).getByRole('button', { name: 'Заселить всё равно' }).click();
  await page.getByRole('main').getByTestId('check-out-ui-item').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Выселить', exact: true }).click();
  await page.getByRole('dialog', { name: 'Выселить с долгом?' }).getByRole('button', { name: 'Выселить с долгом' }).click();
  await cardTab(page, 'Обзор');
  await expect(page.getByRole('main').getByTestId('stay-row').first()).toContainText('Выехал');

  await page.reload();
  await cardTab(page, 'Счета');
  await page.getByTestId('stay-review-issue').click();
  const url = await page.getByTestId('stay-review-url').inputValue();
  expect(url).toMatch(/\/reviews\/stay\//);

  // гость открывает ссылку без входа
  const guest = await browser.newContext();
  const g = await guest.newPage();
  await g.goto(url);
  await expect(g.getByTestId('stay-review-page')).toContainText('Оцените проживание');
  await g.getByTestId('stay-review-send').click();
  await expect(g.getByText('Поставьте оценку от 1 до 5.')).toBeVisible();
  await g.locator('.beauty-review-stars label').nth(3).click();
  await g.getByLabel('Комментарий').fill('Тихо и чисто');
  await g.getByTestId('stay-review-send').click();
  await expect(g.getByTestId('stay-review-done')).toBeVisible();
  await guest.close();

  await page.reload();
  await cardTab(page, 'Счета');
  await expect(page.getByTestId('stay-review-stars')).toHaveAccessibleName('Оценка 4 из 5');
  await expect(page.getByTestId('stay-review-comment')).toHaveText('Тихо и чисто');
  await expect(page.getByTestId('stay-review-issue')).toHaveCount(0);
  if (process.env.CABINET_SHOTS) await page.screenshot({ path: `${process.env.CABINET_SHOTS}/stay-review.png` });
});
