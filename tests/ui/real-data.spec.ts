import { expect, test, type Page } from './fixtures';

const fixture = process.env['UI_FIXTURE_API'] ?? 'http://127.0.0.1:4311';
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

/** «Платформа» открыта только вошедшему главному администратору (ADR-083) */
async function signIn(page: Page) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
}

/*
 * INT1 (ADR-116): источник данных и база — внутренняя диагностика. С «Интеграций» она ушла в «Платформу», к главному
 * администратору; правило проверки прежнее — сбой базы не превращается в нули.
 */
test('источник и агрегаты проекта видны главному администратору в «Платформе», а не на «Интеграциях»', async ({
  page,
  request,
}) => {
  await page.goto('/connections');
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText('Подключения');
  await expect(page.getByTestId('data-connection')).toHaveCount(0);
  await expect(page.getByRole('main')).not.toContainText('Supabase');
  await expect(page.getByRole('main')).not.toContainText('Данные проекта');
  await request.post(`${fixture}/__test/control`, { data: { platformAdmin: true } });
  await signIn(page);
  await page.goto('/platform');
  const panel = page.getByTestId('data-connection');
  await expect(panel).toContainText('Данные проекта');
  await expect(panel).toContainText('Тестовые данные');
  await expect(panel.getByTestId('database-units')).toHaveText('88');
  await expect(panel).not.toContainText('Supabase подключён');
});

test('ошибка базы не превращается в нулевые показатели; повтор обновляет состояние', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, {
    data: { connectionState: 'DATABASE_UNAVAILABLE', platformAdmin: true },
  });
  await signIn(page);
  await page.goto('/platform');
  const panel = page.getByTestId('data-connection');
  await expect(panel).toContainText('База данных недоступна');
  await expect(panel.getByTestId('database-units')).toHaveCount(0);
  await request.post(`${fixture}/__test/control`, {
    data: { connectionState: 'READY', empty: true, platformAdmin: true },
  });
  await page.getByRole('button', { name: 'Обновить' }).click();
  await expect(panel.getByTestId('database-units')).toHaveText('0');
});

test('название гостиницы в каркасе и обзоре поступает из backend', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, { data: { propertyName: 'Проверочный хостел' } });
  await page.goto('/today');
  await expect(page.locator('.workspace-header .workspace-property')).toContainText(
    'Проверочный хостел',
  );
  await expect(page.locator('.workspace-header')).not.toContainText('Luxx Aparts');
});

test('недоступный API не скрывается за демо или выдуманным объектом', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, { data: { failPath: '*' } });
  await page.goto('/connections');
  // нет связи — состояние Channex «неизвестно», а не зелёное и не «не подключено»
  await expect(page.getByTestId('integration-health')).toHaveText('Состояние неизвестно');
  await expect(page.getByTestId('integration-issues')).toContainText(
    'Не удалось проверить менеджер каналов',
  );
  await expect(page.locator('.workspace-header .workspace-property')).toContainText(
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
    await expect(page.locator('.workspace-header .workspace-property')).toContainText(
      'Объект не загружен',
    );
    await request.post(`${fixture}/__test/control`, { data: { holdHotel: false } });
    await expect(page.locator('.workspace-header .workspace-property')).toContainText(
      'Поздний ответ гостиницы',
    );
    await expect(page.getByLabel('Имя *', { exact: true })).toHaveValue('Тестовый ввод');
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
  } finally {
    await request.post(`${fixture}/__test/control`, { data: { holdHotel: false } });
  }
});
