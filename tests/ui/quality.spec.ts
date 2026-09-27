import { expect, test } from './fixtures';
const fixture = 'http://127.0.0.1:4311';
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('неверные параметры списка броней оставляют доступные фильтры и понятную ошибку', async ({
  page,
}) => {
  for (const query of ['status=WRONG', 'page=abc', 'page=-1']) {
    await page.goto(`/reservations?${query}`);
    await expect(page.getByRole('heading', { name: 'Брони', exact: true })).toBeVisible();
    await expect(page.getByRole('main').getByRole('alert')).toContainText(/статус|страниц/i);
    await expect(page.getByRole('button', { name: 'Показать', exact: true })).toBeEnabled();
  }
});

test('короткий поиск гостей объясняет минимум символов', async ({ page }) => {
  await page.goto('/guests?q=А');
  await expect(page.getByText('Введите не менее 2 символов для поиска.')).toBeVisible();
});

test('повторяющиеся параметры поиска не обрушивают гости и журнал', async ({ page }) => {
  await page.goto('/guests?q=Тест&q=Другой');
  await expect(page.getByRole('heading', { name: 'Гости', exact: true })).toBeVisible();
  await page.goto('/journal?q=TEST&q=OTHER');
  await expect(page.getByRole('heading', { name: 'Журнал действий', exact: true })).toBeVisible();
});

test('операция проживания блокирует повторное нажатие до ответа сервера', async ({ page }) => {
  await page.goto('/reservations/20260913-TESTAA');
  await page.getByRole('tab', { name: 'Действия', exact: true }).click();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    const extend = page.getByTestId('extend-ui-item');
    await extend.click();
    // Срез 7.3: продление сначала спрашивает с суммой (предпросмотр — тоже POST на эту страницу,
    // его держать нельзя); команда и блокировка кнопок начинаются с подтверждения
    const dialog = page.locator('dialog[open][data-testid="confirm-dialog"]');
    await expect(dialog).toContainText('Проживание станет');
    await page.route('**/reservations/20260913-TESTAA', async (route) => {
      if (route.request().method() === 'POST') await held;
      await route.continue();
    });
    await dialog.getByRole('button', { name: 'Продлить' }).click();
    await expect(extend).toBeDisabled();
    await expect(page.getByTestId('check-in-ui-item')).toBeDisabled();
  } finally {
    release();
    await page.unrouteAll({ behavior: 'wait' });
  }
});

test('отказ оплаты сохраняет введённую сумму, способ и примечание', async ({ page, request }) => {
  await page.goto('/reservations/20260913-TESTAA');
  await page.getByRole('tab', { name: 'Счета', exact: true }).click();
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/finance/payments' } });
  const form = page.getByTestId('payment-form');
  await form.locator('[name=amount]').fill('3456.78');
  await form.locator('[name=method]').selectOption('KASPI');
  await form.locator('[name=note]').fill('Не терять при отказе');
  await form.getByRole('button', { name: 'Принять оплату' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
  await expect(form.locator('[name=amount]')).toHaveValue('3456.78');
  await expect(form.locator('[name=method]')).toHaveValue('KASPI');
  await expect(form.locator('[name=note]')).toHaveValue('Не терять при отказе');
  await request.post(`${fixture}/__test/control`, { data: {} });
  await form.getByRole('button', { name: 'Принять оплату' }).click();
  await expect(
    page.getByTestId('payment-row').filter({ hasText: 'Не терять при отказе' }),
  ).toHaveCount(1);
  await expect(form.locator('[name=note]')).toHaveValue('');
});

test('ошибочные даты шахматки и месяца тарифов оставляют форму исправления', async ({ page }) => {
  for (const route of [
    '/rates?month=not-a-month',
    '/rates?month=2026-13',
    '/chessboard?from=wrong&to=2026-09-20',
  ]) {
    await page.goto(route);
    await expect(page.getByRole('heading', { name: /Тарифы и цены|Шахматка/ })).toBeVisible();
    await expect(page.getByRole('main').getByRole('alert')).toContainText(/период|месяц/i);
    // форма исправления: у тарифов с 27.09 (ADR-107) кнопки нет — месяц перезагружает данные сам
    if (route.startsWith('/rates'))
      await expect(page.getByRole('main').getByLabel('Месяц', { exact: true })).toBeEnabled();
    else
      await expect(page.getByRole('button', { name: /Показать|Применить/ }).first()).toBeEnabled();
  }
});

test('список гостей и вторая бронь открывают собственные карточки', async ({ page }) => {
  await page.goto('/guests');
  // столько же гостей, сколько броней в фикстуре: добавился «не заехал вовремя» (20260913-TEST8)
  await expect(page.locator('.directory-guest')).toHaveCount(9);
  const link = page.locator('.directory-guest').nth(1);
  const label = await link.locator('strong').innerText();
  await link.click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(label);
  await page.goto('/reservations/20260913-TEST1');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('20260913-TEST1');
});

test('медленная финансовая команда блокирует повтор и соседнюю оплату', async ({ page }) => {
  await page.goto('/reservations/20260913-TESTAA');
  await page.getByRole('tab', { name: 'Счета', exact: true }).click();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/reservations/20260913-TESTAA', async (route) => {
    if (route.request().method() === 'POST') await held;
    await route.continue();
  });
  try {
    page.once('dialog', (d) => d.accept('08:00'));
    const extra = page.getByTestId('early-check-in-ui-folio');
    await extra.click();
    await expect(extra).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Принять оплату', exact: true })).toBeDisabled();
  } finally {
    release();
    await page.unrouteAll({ behavior: 'wait' });
  }
});

test('изменение уборки относится только к выбранному номеру', async ({ page }) => {
  // 22.09: цикл словами — R02 проверена, кнопка «Требует уборки» возвращает её в уборку; R03 не тронута
  await page.goto('/units/R02');
  await page.getByTestId('hk-DIRTY').click();
  // при переходе Next на миг держит уходящую страницу в DOM — ищем в видимом main (TESTING.md §3)
  await expect(
    page.getByRole('main').getByText('Сейчас требует уборки', { exact: true }),
  ).toBeVisible();
  await page.goto('/units/R03');
  await expect(
    page.getByRole('main').getByText('Сейчас проверено, доступна', { exact: true }),
  ).toBeVisible();
});

test('неподключённые внешние демо не ведут на несуществующие страницы', async ({ page }) => {
  await page.goto('/analytics/setup');
  await expect(page.getByText('Демо счётчика не подключено', { exact: true })).toBeVisible();
  // После упрощения настроек код виджета лежит в свёртке: раскрываем её, как это делает пользователь
  await page
    .locator('summary')
    .getByText('Установка виджета бронирования', { exact: true })
    .click();
  await expect(page.getByText('Демо виджета не подключено', { exact: true })).toBeVisible();
  await expect(page.locator('a[href="/demo"], a[href="/demo-booking"]')).toHaveCount(0);
});

for (const scenario of [
  {
    name: 'профиль гостя',
    path: '/guests/ui-guest',
    form: 'guest-form',
    button: 'Сохранить',
    fields: { firstName: 'Synthetic', notes: 'Сохранить заметку' },
  },
  {
    name: 'документ гостя',
    path: '/guests/ui-guest',
    form: 'document-form',
    button: 'Добавить',
    fields: { number: 'TEST-ONLY', issueCountry: 'KAZ' },
  },
  {
    name: 'блокировка номера',
    path: '/units/R01',
    form: 'block-form',
    button: 'Заблокировать',
    fields: { dateFrom: '2026-09-18', dateTo: '2026-09-20', reason: 'Сохранить причину' },
  },
  {
    name: 'сайт аналитики',
    path: '/analytics/setup',
    form: 'site-form',
    button: 'Добавить сайт',
    fields: { name: 'Тестовый сайт', hosts: 'example.invalid' },
  },
]) {
  test(`отказ API сохраняет поля: ${scenario.name}`, async ({ page, request }) => {
    await page.goto(scenario.path);
    await request.post(`${fixture}/__test/control`, { data: { failPath: '*' } });
    const form = page.getByTestId(scenario.form);
    for (const [field, value] of Object.entries(scenario.fields)) {
      if (value !== undefined) await form.locator(`[name=${field}]`).fill(value);
    }
    const submit = form.getByRole('button', { name: scenario.button, exact: true });
    for (let attempt = 0; attempt < 2; attempt++) {
      await submit.click();
      await expect(
        page.getByRole('main').getByRole('alert').filter({ hasText: 'Синтетический сбой API' }),
      ).toBeVisible();
      await expect(submit).toBeEnabled();
      for (const [field, value] of Object.entries(scenario.fields)) {
        if (value !== undefined) await expect(form.locator(`[name=${field}]`)).toHaveValue(value);
      }
    }
  });
}
