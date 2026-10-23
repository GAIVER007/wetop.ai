import { FIXTURE_API, expect, test } from './fixtures';

test('business metadata and branch archive survive reload; second brand keeps its identity', async ({
  page,
  request,
}) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await page.goto('/branches');
  const first = page.locator('.org-card').first();
  expect(
    await first
      .locator('.org-business-kind')
      .evaluate((element) => parseFloat(getComputedStyle(element).marginTop)),
  ).toBeLessThanOrEqual(4);
  expect(await first.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThan(
    720,
  );
  const originalBranch = await first.locator('.org-branch-rows strong').first().innerText();
  await first.getByRole('button', { name: /^Редактировать:/ }).click();
  const editor = page.getByRole('dialog', { name: 'Редактировать карточку', exact: true });
  await expect(editor.getByRole('region', { name: 'Обложка бизнеса' })).toBeVisible();
  expect(await editor.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(
    true,
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `reports/organizations-card-editor-2026-10-13/editor-polish-${width}.png`,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await editor.getByLabel('Название бизнеса', { exact: true }).fill('Acceptance Brand');
  await editor.getByRole('textbox', { name: /^Описание/ }).fill('Persisted business description');
  await editor.getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(editor).not.toBeVisible();
  await page.reload();
  const card = page
    .locator('.org-card')
    .filter({ has: page.getByRole('heading', { name: 'Acceptance Brand', exact: true }) });
  await expect(card).toContainText('Persisted business description');
  await card.getByRole('button', { name: 'Редактировать: Acceptance Brand' }).click();
  await editor.getByRole('tab', { name: /Объекты и филиалы/ }).click();
  await editor
    .locator('li')
    .filter({ hasText: originalBranch })
    .getByRole('button', { name: 'Удалить филиал', exact: true })
    .click();
  const archive = page.getByRole('dialog', { name: 'Удалить филиал?', exact: true });
  await expect(archive).toContainText('Филиал переместится в архив');
  await archive.getByRole('button', { name: 'Удалить филиал', exact: true }).click();
  await expect(archive).not.toBeVisible();
  await editor.getByRole('button', { name: 'Закрыть редактор' }).click();
  await page.reload();
  await expect(card).toHaveCount(0);
  await page.getByRole('button', { name: /^Архив \(/ }).click();
  const archived = page.getByRole('dialog', { name: 'Архив объектов', exact: true });
  await archived
    .locator('li')
    .filter({ hasText: originalBranch })
    .getByRole('button', { name: 'Восстановить', exact: true })
    .click();
  const restore = page.getByRole('dialog', { name: 'Восстановить объект?', exact: true });
  await restore.getByRole('button', { name: 'Восстановить', exact: true }).click();
  await expect(restore).not.toBeVisible();
  await archived.getByRole('button', { name: 'Закрыть архив' }).click();
  await page.reload();
  await expect(card.locator('.org-branch-rows')).toContainText(originalBranch);
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  const creation = page.getByRole('dialog', { name: 'Добавить бизнес или филиал' });
  await creation.getByLabel('Новый бизнес или бренд').check();
  await creation.getByLabel('Название бизнеса', { exact: true }).fill('Second Hotel Brand');
  await creation
    .getByRole('textbox', { name: /^Название первого объекта/ })
    .fill('Second Hotel Branch');
  await creation.getByRole('button', { name: /Создать бизнес/ }).click();
  await expect(creation.getByRole('status')).toContainText('создан');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Second Hotel Brand', exact: true }),
  ).toBeVisible();
  await expect(card).toContainText('Persisted business description');
  await expect(page.locator('.org-bottom, .org-object-results')).toHaveCount(0);
  await expect(page.getByTestId('org-totals')).toBeVisible();
});
