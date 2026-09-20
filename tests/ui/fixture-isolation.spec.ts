import { expect, test } from '@playwright/test';

const fixture = 'http://127.0.0.1:4311';
const headers = { 'x-wetop-test-client': '1' };
const booking = '/reservations/20260913-TESTAA';

test('сброс после дизайн-сценария восстанавливает названия категорий и ячеек', async ({
  request,
}) => {
  await request.post(`${fixture}/__test/reset`);
  await request.post(`${fixture}/__test/design-seed`);
  await request.post(`${fixture}/__test/reset`);
  const card = await (await request.get(`${fixture}${booking}`, { headers })).json();
  expect(card.items[0].accommodationTypeName).toBe('Двухместный номер');
  const unit = await (await request.get(`${fixture}/units/R01`, { headers })).json();
  expect(unit.accommodationTypeName).toBe('Двухместный номер');
});

test('сумма продления в подтверждении совпадает с подсказкой и записанным проживанием', async ({
  request,
}) => {
  await request.post(`${fixture}/__test/reset`);
  const item = `${booking}/items/ui-item`;
  const hint = await (await request.get(`${fixture}${item}/extend-preview`, { headers })).json();
  const preview = await (
    await request.get(`${fixture}${item}/preview?action=extend&nights=1`, { headers })
  ).json();
  expect(hint.addedMinor).toBe('800000');
  expect(preview.differenceMinor).toBe(hint.addedMinor);
  const response = await request.post(`${fixture}${item}/extend`, { headers, data: { nights: 1 } });
  expect(response.ok()).toBe(true);
  const card = await (await request.get(`${fixture}${booking}`, { headers })).json();
  expect(card.items[0].priceMinor).toBe(preview.newPriceMinor);
});
