import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

const api = `http://127.0.0.1:${process.env.BEAUTY_UI_API_PORT || '26814'}`;
const evidence = process.env.ZAPIS_EVIDENCE || 'test-results/zapis-report';

type Fixture = {
  business: string;
  locations: string[];
  members: { manager: string; staff: string };
};

test.use({ actionTimeout: 15000, reducedMotion: 'reduce' });

test.afterEach(async ({ request }) => {
  const cleanup = await request.post(`${api}/__test/cleanup`);
  expect(cleanup.ok(), await cleanup.text()).toBe(true);
});

test('positions: CRUD matrix, assignment, revoke history, stale revision and responsive themes', async ({
  page,
  request,
}) => {
  test.setTimeout(180000);
  const reset = await request.post(`${api}/__test/reset`);
  expect(reset.ok()).toBe(true);
  const fixture = (await reset.json()) as Fixture;
  const pointer = `business=${fixture.business};location=${fixture.locations[0]}`;
  const headers = { 'x-wetop-scope': pointer };
  await page.context().addCookies([
    {
      name: 'wetop_session',
      value: 'synthetic-beauty-ui-session',
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: 'wetop_scope',
      value: encodeURIComponent(pointer),
      domain: '127.0.0.1',
      path: '/',
    },
  ]);

  {
    await page.goto('/team/roles');
    await expect(page.getByRole('heading', { name: 'Должности салона', exact: true })).toBeVisible();
    await expect(page.getByLabel('Название должности', { exact: true })).toHaveValue('Администратор');
    // шаблон администратора без возврата денег (владелец 25.10.2026): возврат включает владелец отдельно
    await expect(page.getByRole('checkbox', { name: /Возврат оплаты/ })).not.toBeChecked();
    await expect(page.getByText('Календарь и график', { exact: true })).toBeVisible();
    await expect(page.getByText('Отзывы', { exact: true })).toBeVisible();

    await page.getByLabel('Название должности', { exact: true }).fill('Тестовый администратор');
    await page.getByRole('checkbox', { name: 'Клиенты: Удаление', exact: true }).check();
    // возврат денег владелец включает явно: отдельное право сохраняется вместе с должностью
    await page.getByRole('checkbox', { name: /Возврат оплаты/ }).check();
    await page.getByRole('button', { name: 'Создать должность', exact: true }).click();
    await expect(page.getByText('Должность создана', { exact: true })).toBeVisible();

    const firstWorkspaceResponse = await request.get(`${api}/beauty/positions`, { headers });
    expect(firstWorkspaceResponse.ok()).toBe(true);
    const firstWorkspace = await firstWorkspaceResponse.json();
    const created = firstWorkspace.positions.find(
      (position: { name: string }) => position.name === 'Тестовый администратор',
    );
    expect(created).toMatchObject({ revision: 1, archivedAt: null });
    expect(created.permissions).toContainEqual({
      section: 'finance',
      action: 'refund',
      scope: 'BUSINESS',
    });

    await page.getByLabel('Название должности', { exact: true }).fill('Старший тестовый администратор');
    await page.getByRole('checkbox', { name: 'Услуги и техкарты: Изменение', exact: true }).check();
    await page.getByRole('button', { name: 'Сохранить должность', exact: true }).click();
    await expect(page.getByText('Должность сохранена', { exact: true })).toBeVisible();

    const stale = await request.patch(`${api}/beauty/positions/${created.id}`, {
      headers,
      data: {
        name: 'Потерянная тестовая правка',
        expectedRevision: created.revision,
        permissions: created.permissions,
      },
    });
    expect(stale.status()).toBe(409);
    const afterStaleResponse = await request.get(`${api}/beauty/positions`, { headers });
    expect(afterStaleResponse.ok()).toBe(true);
    const afterStale = await afterStaleResponse.json();
    expect(afterStale.positions.find((position: { id: string }) => position.id === created.id)).toMatchObject({
      name: 'Старший тестовый администратор',
      revision: 2,
    });

    const user = page.getByRole('combobox', { name: 'Сотрудник', exact: true });
    const managerOption = user.locator(`option[value="${fixture.members.manager}"]`);
    await expect(managerOption).toContainText('Тестовая управляющая Мария');
    await user.selectOption(fixture.members.manager);
    await page.getByRole('combobox', { name: 'Должность', exact: true }).selectOption({
      label: 'Старший тестовый администратор',
    });
    await page.getByRole('combobox', { name: 'Филиал', exact: true }).selectOption({
      label: 'Тестовый филиал Центр',
    });
    await page.getByRole('button', { name: 'Сохранить назначение', exact: true }).click();
    await expect(page.getByText('Должность назначена', { exact: true })).toBeVisible();

    let assignment = page.locator('.beauty-assignment').filter({ hasText: 'Тестовая управляющая Мария' });
    await expect(assignment).toContainText('Старший тестовый администратор');
    await expect(assignment).toContainText('Тестовый филиал Центр');
    await assignment.getByRole('button', { name: 'Отозвать доступ', exact: true }).click();
    const confirm = page.getByTestId('confirm-dialog');
    await expect(confirm).toContainText('Старая роль не вернёт доступ к салону');
    await confirm.getByRole('button', { name: 'Отозвать доступ', exact: true }).click();
    await expect(page.getByText('Назначение отозвано', { exact: true })).toBeVisible();
    assignment = page.locator('.beauty-assignment').filter({ hasText: 'Тестовая управляющая Мария' });
    await expect(assignment).toContainText('Отозвано');
    await expect(assignment).toContainText('Старая роль не вернёт доступ');
    await expect(assignment.getByRole('button', { name: 'Отозвать доступ' })).toHaveCount(0);

    await page.reload();
    assignment = page.locator('.beauty-assignment').filter({ hasText: 'Тестовая управляющая Мария' });
    await expect(assignment).toContainText('Отозвано');
    const persistedResponse = await request.get(`${api}/beauty/positions`, { headers });
    expect(persistedResponse.ok()).toBe(true);
    const persisted = await persistedResponse.json();
    expect(
      persisted.assignments.find(
        (item: { userId: string; positionId: string }) =>
          item.userId === fixture.members.manager && item.positionId === created.id,
      ),
    ).toMatchObject({ revision: 2, revokedAt: expect.any(String) });

    mkdirSync(evidence, { recursive: true });
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        await page.screenshot({
          path: `${evidence}/positions-${width}-${colorScheme}.png`,
          fullPage: true,
        });
      }
    }
  }
});
