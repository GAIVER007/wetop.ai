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
  await expect(main.getByRole('heading', { name: 'Организация', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  expect(
    await page
      .locator('.org-heading-controls')
      .evaluate((element) => getComputedStyle(element).display),
  ).toBe('flex');
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(900);
  // От 1280 px разделы находятся в шапке, кнопка выдвижного меню скрыта из доступного интерфейса.
  await expect(page.getByRole('button', { name: 'Открыть меню', exact: true })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Главное меню', exact: true })).toBeVisible();
  const monthControls = await page
    .locator('.org-month a, .org-month input, .org-month button')
    .evaluateAll((elements) =>
      elements.map((element) => ({
        height: element.getBoundingClientRect().height,
        bottom: element.getBoundingClientRect().bottom,
      })),
    );
  expect(monthControls).toHaveLength(4);
  expect(monthControls.every((control) => control.height === 40)).toBe(true);
  expect(
    monthControls.every((control) => Math.abs(control.bottom - monthControls[0]!.bottom) < 1),
  ).toBe(true);

  await main.getByRole('button', { name: 'Добавить', exact: true }).click();
  const creation = page.getByRole('dialog', { name: 'Добавить бизнес или филиал' });
  await expect(creation).toBeVisible();
  // Existing businesses remain after reset. Explicitly create a new brand and its first branch.
  await creation.getByLabel('Новый бизнес или бренд').check();
  await creation.getByLabel('Название бизнеса', { exact: true }).fill('Тестовый бизнес у парка');
  await creation
    .getByRole('textbox', { name: /^Название первого объекта/ })
    .fill('Тестовый филиал у парка');
  await creation.getByRole('button', { name: 'Создать бизнес', exact: true }).click();
  await expect(creation.getByRole('status')).toContainText(/создан/);
  await page.reload();
  await expect(
    main.getByRole('button').filter({ hasText: 'Тестовый филиал у парка' }),
  ).toBeVisible();
  await expect(main.locator('.org-bottom, .org-object-results')).toHaveCount(0);
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (width >= 1024) {
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(
        900,
      );
      const card = await main.locator('.org-card').first().boundingBox();
      expect(card).not.toBeNull();
      // Compact cards remain within the approved first-screen bound, including multiple businesses.
      expect(card!.y + card!.height).toBeLessThanOrEqual(900);
    }
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
  await expect(page.locator('summary').filter({ hasText: 'Добавить филиал' })).toHaveCount(0);
  await request.post(`${FIXTURE_API}/__test/control`, { data: { platformAdmin: true } });
  await page.reload();
  const main = page.getByRole('main');
  // одна страница: организация, итоги, филиалы и таблица всех организаций видны сразу, без раскрывашек
  await expect(main.getByRole('heading', { name: 'Организации', level: 1 })).toBeVisible();
  await expect(main.getByRole('region', { name: 'Итоги по филиалам' })).toBeVisible();
  await expect(main.getByTestId('platform-organizations')).toBeVisible();
  // служебные ID на экран не выводятся, «реквизитов» и «объекта / филиала» в словах нет
  await expect(main).not.toContainText('ID филиала');
  await expect(main).not.toContainText('ID:');
  await expect(main).not.toContainText('Реквизиты организации');
  await expect(main).not.toContainText('объект / филиал');
  await main.locator('summary').filter({ hasText: 'Добавить филиал' }).click();
  await main.getByLabel('Название объекта').fill('Тестовый объект Север');
  await main.getByRole('button', { name: 'Добавить филиал', exact: true }).click();
  await expect(main.getByRole('status')).toContainText('Филиал создан');
  await page.reload();
  await expect(
    main.getByRole('heading', { name: 'Тестовый объект Север', exact: true }),
  ).toBeVisible();
  // показатели стоят прямо в карточке филиала
  await expect(main.getByText('Загрузка').first()).toBeVisible();
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `reports/organizations-page-2026-10-09/organizations-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
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
  const navigation = page.getByRole('main');
  await expect(navigation).toBeVisible();
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
  // в кнопке между названием и адресом подписано направление (#403): «Филиал Север Гостиничный бизнес Тестовая улица…»
  await expect(
    mobile.getByRole('button', { name: /Филиал Север .*Тестовая улица/ }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'reports/branches-2026-10-01/switcher-mobile.png' });
});
