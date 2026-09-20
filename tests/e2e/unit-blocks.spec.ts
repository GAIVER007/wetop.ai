import { expect, test } from './fixtures';
import { confirmAction } from './confirm';
import { roomiestCategory } from './pick-category';

/** Срез 5, B2: блокировка ячейки видна в шахматке и уменьшает доступность; снятие возвращает; статус уборки меняется. */
const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
/*
 * Свой отрезок будущих суток. Два спека на одних ночях дерутся за одни и те же койки:
 * прогон в два воркера падал то на одном тесте, то на другом, а поодиночке был зелёным.
 * Карта отрезков — tests/README.md, раздел «Окна дат». Новый спек — новый отрезок.
 */
const BASE = 18;
const plus = (n: number) => {
  const x = new Date(`${today}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + BASE + n);
  return x.toISOString().slice(0, 10);
};
/*
 * Метка своя на каждый прогон: если прошлый прогон сорвался между «заблокировать» и «снять», его блок
 * остался на койке, и счёт по общему тексту причины давал два вместо одного. Уборка снимает всё, что
 * начинается с этой метки (cli-e2e-cleanup).
 */
const REASON = `${'E2E-АВТОТЕСТ'}: замена матраса ${Date.now().toString(36)}`;
const FROM = plus(40);
const TO = plus(42);

test('заблокировать свободную койку на 2 ночи → шахматка красит, свободных −1 → снять → как было; уборка', async ({
  page,
  request,
}) => {
  await page.goto(`/reservations/new?arrival=${FROM}&departure=${TO}`);
  await page
    .getByRole('main')
    .getByTestId('new-reservation-form')
    .locator('select[name="accommodationTypeCode"]')
    .selectOption(await roomiestCategory(request, FROM, TO));
  const unitCode = (await page
    .getByRole('main')
    .getByTestId('new-reservation-form')
    .locator('select[name="unitCode"] option')
    .nth(1)
    .getAttribute('value'))!;
  const freeBefore = Number(
    /свободно (\d+)/.exec(
      (await page.getByRole('main').getByTestId('availability').textContent()) ?? '',
    )?.[1],
  );

  await page.goto(`/units/${unitCode}`);
  await expect(page.getByRole('heading', { name: new RegExp(`Ячейка ${unitCode}`) })).toBeVisible();
  const form = page.getByRole('main').getByTestId('block-form');
  await form.locator('input[name="dateFrom"]').fill(FROM);
  await form.locator('input[name="dateTo"]').fill(TO);
  await form.locator('select[name="type"]').selectOption('MAINTENANCE');
  await form.locator('input[name="reason"]').fill(REASON);
  await form.getByRole('button', { name: 'Заблокировать' }).click();
  // на койке могут лежать чужие блоки (другие тесты, стойка) — считаем только свой, по причине
  const ownBlock = page.getByRole('main').getByTestId('block-row').filter({ hasText: REASON });
  await expect(ownBlock).toHaveCount(1);
  await page.screenshot({ path: 'reports/screenshots/unit-block-card.png', fullPage: true });

  await page.goto(`/chessboard?from=${FROM}&to=${TO}`);
  const row = page
    .getByRole('main')
    .getByTestId('unit-row')
    .filter({ has: page.getByTestId('unit-link').filter({ hasText: unitCode }) });
  await expect(row.locator('td[data-state="BLOCKED"]')).toHaveCount(2);
  await page.goto(`/reservations/new?arrival=${FROM}&departure=${TO}`);
  expect(
    Number(
      /свободно (\d+)/.exec(
        (await page.getByRole('main').getByTestId('availability').textContent()) ?? '',
      )?.[1],
    ),
  ).toBe(freeBefore - 1);

  await page.goto(`/units/${unitCode}`);
  // именно свою строку: на той же койке может лежать блок другого спека (даты разные, койка одна),
  // и тогда кнопок «снять» на странице две — клик по роли падал бы на strict mode
  // снятие блокировки переспрашивает (волна 3) — окном стойки, не window.confirm (DESIGN.md §8)
  await ownBlock.getByRole('button', { name: 'снять' }).click();
  // с 17.09 снятие блокировки спрашивают окном: койка сразу возвращается в продажу (DESIGN.md §15)
  await confirmAction(page, 'Снять блокировку');
  await expect(ownBlock).toHaveCount(0);
  await page.goto(`/reservations/new?arrival=${FROM}&departure=${TO}`);
  expect(
    Number(
      /свободно (\d+)/.exec(
        (await page.getByRole('main').getByTestId('availability').textContent()) ?? '',
      )?.[1],
    ),
  ).toBe(freeBefore);

  await page.goto(`/units/${unitCode}`);
  await page.getByRole('main').getByTestId('hk-CLEAN').click();
  await expect(page.getByText('Статус уборки: убрано')).toBeVisible();
  await page.getByRole('main').getByTestId('hk-DIRTY').click();
  await expect(page.getByText('Статус уборки: грязно')).toBeVisible();
});
