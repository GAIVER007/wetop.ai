import { expect, test } from './fixtures';

/**
 * Онбординг нового отеля (plans/onboarding-2026-09-21.md): пока у объекта нет номеров, рабочие
 * экраны уводят на /onboarding; после «Запустить отель» — на рабочее место, и гейт больше не мешает.
 */
const fixture = 'http://127.0.0.1:4311';

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

test('администратор в ненастроенном отеле: не тупик «Нет доступа», а кто настраивает (ADR-106)', async ({
  page,
  request,
}) => {
  // входим, пока отель настроен: после входа стойка ведёт на «Главную», а гейт увёл бы на онбординг
  await request.post(`${fixture}/__test/control`, { data: { onboardingNeeded: false } });
  await page.goto('/login');
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
 * Время до первой пользы (ТЗ `plans/ux-retention-2026-09-26.md` пп. 0.2, 2.1, 2.2): после «Запустить отель» Главная
 * показывает «Первые шаги» и ведёт к первой брони; бронь создаётся, и панель уходит сама. Тест считает путь —
 * экраны после онбординга до карточки брони: Главная → форма → карточка (цель ТЗ ≤ 3).
 */
test('после запуска отеля — «Первые шаги» ведут к первой брони, после неё панель уходит', async ({
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

  const steps = page.getByTestId('first-steps');
  await expect(steps.getByRole('heading', { name: 'Первые шаги' })).toBeVisible();
  await expect(steps.getByRole('listitem')).toHaveCount(4);
  await expect(steps.getByRole('listitem').first()).toContainText('готово');
  await steps.getByRole('link', { name: 'Создать первую бронь' }).click();

  const form = page.getByTestId('new-reservation-form');
  await form.getByLabel('Имя *', { exact: true }).fill('Первый');
  await form.getByLabel('Фамилия *', { exact: true }).fill('Гость');
  await form.getByRole('button', { name: 'Создать бронь' }).click();
  await expect(page).toHaveURL(/\/reservations\/20260913-NEW\d+$/);

  await page.goto('/today');
  await expect(page.getByRole('heading', { name: 'Главная', level: 1 })).toBeVisible();
  await expect(page.getByTestId('first-steps')).toHaveCount(0);
});

test('у работающего отеля с бронями «Первых шагов» нет', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, { data: { onboardingNeeded: false } });
  await page.goto('/today');
  await expect(page.getByRole('heading', { name: 'Главная', level: 1 })).toBeVisible();
  await expect(page.getByTestId('first-steps')).toHaveCount(0);
});

/**
 * «Заполнить позже» (plans/site-auth-dialog-tour-2026-09-27.md, Д3, ADR-100): после подтверждения почты человек может
 * не заводить номера сразу. Стойка открывается, гейт больше не уводит, а Главная первым шагом ведёт настроить отель.
 */
test('«Заполнить позже»: стойка открывается, Главная ведёт настроить номера и цены', async ({ page, request }) => {
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
  const steps = page.getByTestId('first-steps');
  await expect(steps).toContainText('Настройте номера и цены');
  await expect(steps.getByRole('link', { name: 'Настроить отель' })).toHaveAttribute('href', '/onboarding');
  await page.screenshot({ path: 'test-results/onboarding-later-2-today.png' });

  // другой рабочий экран тоже не уводит
  await page.goto('/reservations');
  await expect(page).toHaveURL(/\/reservations/);
  // а ссылка ведёт обратно в настройку
  await page.goto('/onboarding');
  await expect(page.getByRole('main').getByRole('heading', { name: 'Настройте отель', level: 1 })).toBeVisible();
});
