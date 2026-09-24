import { test, expect } from './fixtures';

test.beforeEach(async ({ request }) => {
  await request.post('http://127.0.0.1:4311/__test/reset');
});

test('правый край брони: продление на несколько ночей с подтверждением и отменой', async ({
  page,
}) => {
  await page.goto('/chessboard');
  const handle = page.getByRole('button', { name: /Продлить проживание.*перетяните/ }).first();
  await expect(handle).toBeVisible();
  await handle.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('2');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Отмена|Отменить|Оставить/ })
    .click();
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('мышь: правый край добавляет две ночи только после подтверждения; результат переживает reload', async ({
  page,
  request,
}) => {
  await page.goto('/chessboard');
  const row = page.locator('[data-unit-code="R04"][data-testid="unit-row"]');
  const handle = row.locator('.board-stay-resize');
  const last = await handle.locator('..').getAttribute('data-date');
  const targetDate = new Date(`${last}T12:00:00Z`);
  targetDate.setUTCDate(targetDate.getUTCDate() + 2);
  const target = row.locator(`td[data-date="${targetDate.toISOString().slice(0, 10)}"]`);
  await handle.scrollIntoViewIfNeeded();
  const from = (await handle.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await expect(page.getByRole('status').filter({ hasText: '+2 ноч.' })).toBeVisible();
  await page.mouse.up();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('2 ноч');
  await expect(dialog).toContainText('₸');
  const commands = async () =>
    (await (await request.get('http://127.0.0.1:4311/__test/commands')).json()).filter(
      (c: { path: string }) => c.path.endsWith('/extend'),
    );
  expect(await commands()).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Продлить', exact: true }).click();
  await expect.poll(commands).toHaveLength(1);
  const posted = (await commands())[0];
  expect(posted.body.nights).toBe(2);
  await expect(target).toHaveAttribute('data-state', 'OCCUPIED');
  await page.reload();
  await expect(target).toHaveAttribute('data-state', 'OCCUPIED');
});

test('отказ сохранения не удлиняет плашку, а отсутствие цены не открывает подтверждение', async ({
  page,
  request,
}) => {
  await page.goto('/chessboard');
  const row = page.locator('[data-unit-code="R04"][data-testid="unit-row"]');
  const handle = row.locator('.board-stay-resize');
  const originalDate = await handle.locator('..').getAttribute('data-date');
  await handle.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await request.post('http://127.0.0.1:4311/__test/control', {
    data: { failPath: '/reservations/20260913-TEST3/items/ui-item-3/extend', failStatus: 409 },
  });
  await dialog.getByRole('button', { name: 'Продлить', exact: true }).click();
  await expect(page.getByTestId('drag-error')).toContainText('отклонён');
  await expect(handle.locator('..')).toHaveAttribute('data-date', originalDate!);
  // Пока идёт «Сохраняем изменения…», ручка отключена: нажатия сразу после отказа пропадали, и тест
  // видел прежнюю ошибку (1 раз из 5 у автора, 24.09.2026). Человек так быстро не жмёт — ждём, как он.
  await expect(page.getByTestId('drag-pending')).toHaveCount(0);
  await expect(handle).toBeEnabled();
  await request.post('http://127.0.0.1:4311/__test/control', {
    data: { failPath: '/reservations/20260913-TEST3/items/ui-item-3/preview' },
  });
  await handle.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('drag-error')).toContainText('Не удалось рассчитать');
  await expect(dialog).toBeHidden();
});

test('одна видимая ночь: имя имеет две строки, канал не отнимает ширину', async ({ page }) => {
  await page.goto('/chessboard');
  const row = page.locator('[data-unit-code="R01"][data-testid="unit-row"]');
  const last = await row.locator('.board-stay-resize').locator('..').getAttribute('data-date');
  const end = new Date(`${last}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  await page.goto(`/chessboard?from=${last}&to=${end.toISOString().slice(0, 10)}`);
  const caption = row.locator('.board-stay-caption');
  await expect(caption).toHaveAttribute('data-span', '1');
  await expect(caption.locator('.board-stay-name')).toHaveText('Гость Тестовый');
  const name = caption.locator('.board-stay-name');
  expect(await name.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  await expect(caption.locator('.board-stay-due')).toBeHidden();
  await page.screenshot({ path: 'reports/chessboard-comfort-2026-09-24/short-stay.png' });
});
