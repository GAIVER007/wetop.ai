import { FIXTURE_API, expect, test } from './fixtures';

/**
 * Онбординг нового отеля (plans/onboarding-2026-09-21.md): пока у объекта нет номеров, рабочие
 * экраны уводят на /onboarding; после «Запустить отель» — на рабочее место, и гейт больше не мешает.
 */
const fixture = FIXTURE_API;

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
  await request.post(`${fixture}/__test/control`, { data: { onboardingNeeded: true } });
});

// Стенд общий на весь набор: «нужен онбординг» не должен уйти в следующий файл — там рабочие экраны увело бы
// на /onboarding («Заполнить позже» оставляет объект без номеров, 27.09.2026)
test.afterEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('пустой отель: рабочий экран уводит на онбординг, форма запускает отель', async ({ page }) => {
  // гейт: с рабочего экрана — на онбординг
  await page.goto('/today');
  await expect(page).toHaveURL(/\/onboarding/);
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'Настройте отель', level: 1 })).toBeVisible();

  // название отеля показано и только для чтения
  await expect(main.getByLabel('Название', { exact: true })).toHaveValue('Luxx Aparts');

  // одна категория с ценой
  await main.getByLabel('Название категории').fill('Двухместный номер');
  await main.getByLabel('Гостей на место').fill('2');
  await main.getByLabel('Сколько мест').fill('3');
  await main.getByLabel(/Цена за ночь/).fill('21000');
  await main.getByRole('button', { name: 'Запустить отель' }).click();

  // отель настроен → на рабочее место, гейт больше не уводит
  await page.waitForURL('**/today');
  await expect(page).toHaveURL(/\/today/);
});

test('администратор в ненастроенном отеле: не тупик «Нет доступа», а кто настраивает (ADR-107)', async ({
  page,
  request,
}) => {
  // входим, пока отель настроен: после входа стойка ведёт на «Главную», а гейт увёл бы на онбординг
  await request.post(`${fixture}/__test/control`, { data: { onboardingNeeded: false } });
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');

  await request.post(`${fixture}/__test/control`, {
    data: { onboardingNeeded: true, role: 'STAFF' },
  });
  await page.goto('/today');
  await expect(page).toHaveURL(/\/onboarding/);
  const main = page.getByRole('main');
  await expect(main.getByTestId('onboarding-waiting')).toContainText(
    'настройку делают владелец и управляющий',
  );
  await expect(main.getByRole('button', { name: 'Запустить отель' })).toHaveCount(0);
  await expect(main.getByTestId('no-access')).toHaveCount(0);
});

test('пустая категория без цены — форма просит добавить, отель не создаётся', async ({ page }) => {
  await page.goto('/onboarding');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Запустить отель' }).click();
  await expect(main.getByRole('alert')).toContainText(/хотя бы одну категорию/i);
  await expect(page).toHaveURL(/\/onboarding/);
});

/**
 * «Первые шаги» сняты с Главной по слову владельца 29.09.2026 («не нравится, убери»): после «Запустить отель» Главная
 * открывается без панели-подсказки. С 03.10.2026 кнопки «Новая бронь» на Главной нет: бронь заводится в «Календаре».
 */
test('после запуска отеля Главная без «Первых шагов» и без кнопки брони', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, {
    data: { onboardingNeeded: true, noBookings: true },
  });
  await page.goto('/onboarding');
  const main = page.getByRole('main');
  await main.getByLabel('Название категории').fill('Двухместный номер');
  await main.getByLabel(/Цена за ночь/).fill('21000');
  await main.getByRole('button', { name: 'Запустить отель' }).click();
  await page.waitForURL('**/today');

  await expect(page.getByRole('heading', { name: 'Главная', level: 1 })).toBeVisible();
  await expect(page.getByTestId('first-steps')).toHaveCount(0);
  await expect(page.getByText('Первые шаги')).toHaveCount(0);
  await expect(main.getByRole('link', { name: /Новая бронь/ })).toHaveCount(0);
  await expect(main.getByTestId('owner-paid')).toBeVisible();
});

test('у работающего отеля с бронями «Первых шагов» нет', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, { data: { onboardingNeeded: false } });
  await page.goto('/today');
  await expect(page.getByRole('heading', { name: 'Главная', level: 1 })).toBeVisible();
  await expect(page.getByTestId('first-steps')).toHaveCount(0);
});

/**
 * «Заполнить позже» (plans/site-auth-dialog-tour-2026-09-27.md, Д3, ADR-100): после подтверждения почты человек может
 * не заводить номера сразу. Стойка открывается, гейт больше не уводит; настройка по-прежнему открывается по адресу.
 */
test('«Заполнить позже»: стойка открывается, гейт не уводит, настройка доступна по адресу', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, {
    data: { onboardingNeeded: true, noBookings: true },
  });
  await page.goto('/today');
  await expect(page).toHaveURL(/\/onboarding/);
  const main = page.getByRole('main');
  await expect(main.getByRole('list', { name: 'Путь до работы' })).toContainText('Номера и цены');
  await page.screenshot({ path: 'test-results/onboarding-later-1-form.png', fullPage: true });
  await main.getByTestId('onboarding-later').click();

  await page.waitForURL('**/today');
  await expect(page.getByRole('heading', { name: 'Главная', level: 1 })).toBeVisible();
  // «Первые шаги» сняты 29.09.2026 (слово владельца) — подсказки «Настроить отель» на Главной больше нет
  await expect(page.getByTestId('first-steps')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/onboarding-later-2-today.png' });

  // другой рабочий экран тоже не уводит
  await page.goto('/reservations');
  await expect(page).toHaveURL(/\/reservations/);
  // а ссылка ведёт обратно в настройку
  await page.goto('/onboarding');
  await expect(
    page.getByRole('main').getByRole('heading', { name: 'Настройте отель', level: 1 }),
  ).toBeVisible();
});
