import { FIXTURE_API, expect, test, type Page, openProfileMenu } from './fixtures';

const fixture = FIXTURE_API;
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
  await page.locator('summary').filter({ hasText: 'Состояние системы' }).click();
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
  await page.locator('summary').filter({ hasText: 'Состояние системы' }).click();
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
  await page.goto('/finance');
  await expect(page.locator('.workspace-header .workspace-property')).toContainText(
    'Проверочный хостел',
  );
  await expect(page.locator('.workspace-header')).not.toContainText('Luxx Aparts');
});

test('недоступный API не скрывается за демо или выдуманным объектом', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, { data: { failPath: '*' } });
  await page.goto('/connections');
  // без ответа авторизации гостиничный экран закрыт (DS2 F1, как в workspace.spec): честная ошибка, а не
  // зелёное «Работает», демо-объект или выдуманный фонд
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Не удалось загрузить данные');
  await expect(page.getByTestId('integration-health')).toHaveCount(0);
  await expect(page.getByRole('main')).not.toContainText('Работает');
  await expect(page.locator('body')).not.toContainText('Luxx Aparts');
  await expect(page.getByTestId('database-units')).toHaveCount(0);
  // частичный сбой (менеджер каналов молчит, авторизация жива): состояние «неизвестно», а не зелёное
  await request.post(`${fixture}/__test/control`, {
    data: { failPath: '/channels/channex/connection' },
  });
  await page.goto('/connections');
  await expect(page.getByTestId('integration-health')).toHaveText('Состояние неизвестно');
  await expect(page.getByTestId('integration-issues')).toContainText(
    'Не удалось проверить менеджер каналов',
  );
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
    const firstName = page.getByRole('main').getByRole('searchbox', { name: 'Телефон или имя *', exact: true });
    await firstName.fill('Тестовый ввод');
    // страница ещё стримится (гостиница задержана): меню открывается, когда React оживил кнопку. Клик до
    // оживления терялся на медленном раннере CI (20.09, 184/185)
    const menu = await openProfileMenu(page);
    await expect(page.locator('.workspace-header .workspace-property')).toContainText(
      'Объект не загружен',
    );
    await request.post(`${fixture}/__test/control`, { data: { holdHotel: false } });
    await expect(page.locator('.workspace-header .workspace-property')).toContainText(
      'Поздний ответ гостиницы',
    );
    await expect(firstName).toHaveValue('Тестовый ввод');
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
  } finally {
    await request.post(`${fixture}/__test/control`, { data: { holdHotel: false } });
  }
});
