import { FIXTURE_API, expect, test } from './fixtures';
test('филиалы: создание, сохранение после reload и обзор', async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await page.goto('/branches');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'Организация и филиалы' })).toBeVisible();
  await main.locator('summary').filter({ hasText: 'Добавить филиал' }).click();
  await main.getByLabel('Название филиала').fill('Тестовый филиал у парка');
  await main.getByRole('button', { name: 'Добавить филиал', exact: true }).click();
  await expect(main.getByRole('status')).toContainText('Филиал создан');
  await page.reload();
  await expect(main.getByRole('heading', { name: 'Тестовый филиал у парка' })).toBeVisible();
  await expect(
    main.getByRole('heading', { name: 'Сводка по гостиничным филиалам', exact: true }),
  ).toBeVisible();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `reports/branches-2026-10-01/branches-${width}.png`,
      fullPage: true,
    });
  }
});

test('организации: филиал создаётся прямо в разделе и сохраняется после reload', async ({
  page,
  request,
}) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await page.goto('/platform');
  await expect(page.getByTestId('platform-forbidden')).toBeVisible();
  await expect(page.locator('summary').filter({ hasText: 'Добавить объект / филиал' })).toHaveCount(
    0,
  );
  await request.post(`${FIXTURE_API}/__test/control`, { data: { platformAdmin: true } });
  await page.reload();
  const main = page.getByRole('main');
  await main.locator('summary').filter({ hasText: 'Добавить объект / филиал' }).click();
  await main.getByLabel('Название филиала').fill('Тестовый объект Север');
  await main.getByRole('button', { name: 'Добавить филиал', exact: true }).click();
  await expect(main.getByRole('status')).toContainText('Филиал создан');
  await page.reload();
  await expect(
    main.getByRole('heading', { name: 'Тестовый объект Север', exact: true }),
  ).toBeVisible();
  await expect(
    main.getByRole('heading', { name: 'Сводка по гостиничным филиалам', exact: true }),
  ).toBeVisible();
  await expect(main.getByTestId('platform-organizations')).not.toBeVisible();
  await main.locator('summary').filter({ hasText: 'Подписки и администрирование' }).click();
  await expect(main.getByTestId('platform-organizations')).toBeVisible();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await main.locator('summary').filter({ hasText: 'Подписки и администрирование' }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: 'reports/branches-2026-10-01/platform-branches.png',
    fullPage: true,
  });
  await main.getByRole('button', { name: 'Открыть филиал', exact: true }).click();
  await page.waitForURL('**/today');
});

test('переключатель филиалов сохраняет раздел и выбор после перезагрузки', async ({
  page,
  request,
}) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  const branchId = '66666666-6666-4666-8666-666666666666';
  const seeded = await request.post(`${FIXTURE_API}/branches`, {
    headers: { 'x-wetop-test-client': '1' },
    data: { id: branchId, name: 'Филиал Север', address: 'Тестовая улица, 2' },
  });
  expect(seeded.ok()).toBe(true);
  await request.post(`${FIXTURE_API}/__test/control`, {
    data: { branchWithInventory: true },
  });
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  // Филиалов два: после входа сервер не выбирает первый, человек выбирает сам (SCOPE-HARDENING)
  await page.waitForURL('**/branches');
  expect((await page.context().cookies()).find((c) => c.name === 'wetop_scope')).toBeUndefined();
  await page.goto('/chessboard');
  // объект и филиал стоят в шапке рядом со знаком (ADR-134); список не сдвигает строку разделов
  const sidebar = page.locator('.workspace-header');
  const trigger = sidebar.getByRole('button', { name: 'Выбрать филиал', exact: true });
  const navigation = sidebar.locator('.topmenu');
  const before = await navigation.boundingBox();
  await trigger.click();
  const choices = sidebar.getByRole('region', { name: 'Выбор филиала' });
  await expect(choices).toBeVisible();
  expect((await navigation.boundingBox())!.y).toBe(before!.y);
  await choices.getByLabel('Найти филиал').fill('Нет такого филиала');
  await expect(choices.getByText('Филиалы не найдены')).toBeVisible();
  await choices.getByLabel('Найти филиал').fill('');
  // Указателя ещё нет, и стойка филиал не угадывает (MV8, `9023217b`): в списке оба филиала и ни одного
  // текущего; отметка «Текущий филиал» появляется только после выбора (проверка ниже, после перезагрузки)
  await expect(choices.getByRole('button', { name: /Тестовый центральный филиал/ })).toBeVisible();
  await expect(choices.getByRole('button', { name: /Филиал Север/ })).toBeVisible();
  await expect(choices.getByText('Текущий филиал')).toHaveCount(0);
  await choices.getByRole('button', { name: /Филиал Север/ }).click();
  await expect(trigger).toContainText('Филиал Север');
  await expect(page).toHaveURL(/\/chessboard$/);
  expect((await page.context().cookies()).find((c) => c.name === 'wetop_scope')?.value).toContain(
    branchId,
  );
  await page.reload();
  await expect(trigger).toContainText('Филиал Север');
  await trigger.click();
  await expect(choices.getByRole('button', { name: /Филиал Север/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(choices.getByText('Текущий филиал')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(choices).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(choices.getByRole('button', { name: /Филиал Север/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.screenshot({ path: 'reports/branches-2026-10-01/switcher.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
  const mobile = page.locator('.mobile-navigation');
  await mobile.getByRole('button', { name: 'Выбрать филиал', exact: true }).click();
  await expect(mobile.getByRole('button', { name: /Филиал Север Тестовая/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'reports/branches-2026-10-01/switcher-mobile.png' });
});
