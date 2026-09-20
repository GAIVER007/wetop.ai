import { expect, test } from '@playwright/test';

const fixture = 'http://127.0.0.1:4311';
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('источник и агрегаты проекта видны отдельно от Channex', async ({ page }) => {
  await page.goto('/connections');
  const panel = page.getByTestId('data-connection');
  await expect(panel).toContainText('Данные проекта');
  await expect(panel).toContainText('Тестовые данные');
  await expect(panel.getByTestId('database-units')).toHaveText('88');
  await expect(panel).not.toContainText('Supabase подключён');
  await expect(page.getByRole('button', { name: 'Проверить соединение' })).toBeEnabled();
});

test('ошибка базы не превращается в нулевые показатели; повтор обновляет состояние', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, {
    data: { connectionState: 'DATABASE_UNAVAILABLE' },
  });
  await page.goto('/connections');
  const panel = page.getByTestId('data-connection');
  await expect(panel).toContainText('База данных недоступна');
  await expect(panel.getByTestId('database-units')).toHaveCount(0);
  await request.post(`${fixture}/__test/control`, {
    data: { connectionState: 'READY', empty: true },
  });
  await page.getByRole('button', { name: 'Проверить соединение' }).click();
  await expect(panel.getByTestId('database-units')).toHaveText('0');
});

test('название гостиницы в каркасе и обзоре поступает из backend', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, { data: { propertyName: 'Проверочный хостел' } });
  await page.goto('/today');
  await expect(page.locator('.workspace-sidebar .workspace-property')).toContainText(
    'Проверочный хостел',
  );
  await expect(page.locator('.profile-caption')).toContainText('Проверочный хостел');
  await expect(page.locator('main')).toContainText('Проверочный хостел');
  await expect(page.locator('.workspace-sidebar')).not.toContainText('Luxx Aparts');
});

test('недоступный API не скрывается за демо или выдуманным объектом', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, { data: { failPath: '*' } });
  await page.goto('/connections');
  await expect(page.getByTestId('data-connection')).toContainText('Нет связи с рабочим API');
  await expect(page.locator('.workspace-sidebar .workspace-property')).toContainText(
    'Объект не загружен',
  );
  await expect(page.getByTestId('database-units')).toHaveCount(0);
});

test('поздняя загрузка гостиницы сохраняет ввод формы и открытое меню', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, {
    data: { holdHotel: true, propertyName: 'Поздний ответ гостиницы' },
  });
  try {
    await page.goto('/reservations/new', { waitUntil: 'commit' });
    await page.getByLabel('Имя *', { exact: true }).fill('Тестовый ввод');
    const menu = page.getByRole('button', { name: 'Меню администратора' });
    // страница ещё стримится (гостиница задержана): клик до гидратации кнопки теряется — на медленном
    // раннере CI так и было (20.09, 184/185); повторяем клик, пока меню не раскроется
    await expect(async () => {
      await menu.click();
      await expect(menu).toHaveAttribute('aria-expanded', 'true', { timeout: 1500 });
    }).toPass({ timeout: 15_000 });
    await expect(page.locator('.workspace-sidebar .workspace-property')).toContainText(
      'Объект не загружен',
    );
    await request.post(`${fixture}/__test/control`, { data: { holdHotel: false } });
    await expect(page.locator('.workspace-sidebar .workspace-property')).toContainText(
      'Поздний ответ гостиницы',
    );
    await expect(page.getByLabel('Имя *', { exact: true })).toHaveValue('Тестовый ввод');
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
  } finally {
    await request.post(`${fixture}/__test/control`, { data: { holdHotel: false } });
  }
});
