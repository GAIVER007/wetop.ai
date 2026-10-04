import { expect, test } from './fixtures';

test('гостевой мастер: ручной ввод, живое превью, восстановление после перезагрузки', async ({
  page,
}) => {
  let state = {
    guestSessionId: 'test-session',
    lastStep: 'intro',
    draft: {
      businessName: '',
      niche: '',
      description: '',
      wizardData: {} as Record<string, string>,
      revision: 0,
      hasGenerated: false,
      testMessagesUsed: 0,
    },
  };
  await page.route('**/api/wizard', async (route) => {
    const body = route.request().postDataJSON();
    if (body.operation === 'save') {
      state = {
        ...state,
        lastStep: body.step,
        draft: {
          ...state.draft,
          ...body.config,
          wizardData: body.config,
          revision: state.draft.revision + 1,
        },
      };
    }
    await route.fulfill({
      json: { ...state, ...(body.token ? {} : { guestToken: `wz_${'a'.repeat(64)}` }) },
    });
  });
  await page.goto('/create?ref=test');
  await page.getByRole('button', { name: 'Начать создание' }).click();
  await page.getByRole('button', { name: 'Настроить вручную' }).click();
  await page.getByLabel('Название компании').fill('Тестовый хостел');
  await page.getByLabel('Ниша').fill('Гостиница');
  await page.getByLabel('Имя ассистента').fill('Тестовый помощник');
  await expect(page.getByRole('complementary', { name: 'Превью агента' })).toContainText(
    'Тестовый помощник',
  );
  await page.getByRole('button', { name: 'Сохранить черновик' }).click();
  await expect(page.getByRole('status')).toContainText('Черновик сохранён');
  await page.reload();
  await expect(page.getByLabel('Название компании')).toHaveValue('Тестовый хостел');
  await expect(page.getByLabel('Имя ассистента')).toHaveValue('Тестовый помощник');
  await expect(page.locator('.workspace-header')).toHaveCount(0);
});

test('отказ сохранения не теряет ввод и не показывает успешный результат', async ({ page }) => {
  await page.route('**/api/wizard', async (route) => {
    const body = route.request().postDataJSON();
    if (body.operation === 'save')
      return route.fulfill({
        status: 409,
        json: { message: 'Черновик изменился. Обновите страницу' },
      });
    await route.fulfill({
      json: {
        guestSessionId: 'test',
        guestToken: `wz_${'b'.repeat(64)}`,
        lastStep: 'review',
        draft: { wizardData: {}, revision: 0 },
      },
    });
  });
  await page.goto('/create');
  await page.getByLabel('Название компании').fill('Вымышленный объект');
  await page.getByLabel('Ниша').fill('Хостел');
  await page.getByRole('button', { name: 'Сохранить черновик' }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('Черновик изменился');
  await expect(page.getByLabel('Название компании')).toHaveValue('Вымышленный объект');
});

test('истёкшая сессия: явный новый черновик вместо бесконечного повтора', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('wetop.wizard.token', `wz_${'c'.repeat(64)}`),
  );
  await page.route('**/api/wizard', async (route) => {
    const body = route.request().postDataJSON();
    if (body.token)
      return route.fulfill({ status: 401, json: { message: 'Сессия мастера истекла' } });
    await route.fulfill({
      json: {
        guestSessionId: 'new',
        guestToken: `wz_${'d'.repeat(64)}`,
        lastStep: 'intro',
        draft: { wizardData: {}, revision: 0 },
      },
    });
  });
  await page.goto('/create');
  await page.getByRole('button', { name: 'Начать новый черновик' }).click();
  await expect(page.getByRole('button', { name: 'Начать создание' })).toBeVisible();
});
