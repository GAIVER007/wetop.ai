import { expect, test, type Page } from './fixtures';

/**
 * Обучение в стойке (plans/site-auth-dialog-tour-2026-09-27.md, Д4, ADR-100): после первого входа на Главной само
 * открывается окно «Добро пожаловать», шаги подсвечивают поиск, разделы меню и профиль. «Пропустить» или последний
 * шаг ставят отметку — повторно само не открывается; пункт меню профиля показывает обучение ещё раз.
 */
const API = 'http://127.0.0.1:4311';

test.use({ tour: true });

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
}

test('первый вход: обучение открывается само, идёт по шагам и больше само не открывается', async ({ page }) => {
  await signIn(page);
  const tour = page.getByTestId('product-tour');
  await expect(tour.getByRole('heading', { name: 'Добро пожаловать в WETOP' })).toBeVisible();
  await expect(tour).toContainText(/1 из \d+/);
  await page.screenshot({ path: 'test-results/product-tour-1-welcome.png' });

  await tour.getByRole('button', { name: 'Далее' }).click();
  await expect(tour.getByRole('heading', { name: 'Поиск по всей стойке' })).toBeVisible();
  // подсветка стоит над полем поиска
  const hole = page.locator('.tour__hole');
  await expect(hole).toBeVisible();
  await page.waitForTimeout(400); // вырез переезжает к элементу 180 мс
  const [holeBox, searchBox] = await Promise.all([
    hole.boundingBox(),
    page.locator('[data-tour="search"]').boundingBox(),
  ]);
  expect(holeBox && searchBox).toBeTruthy();
  // вырез охватывает поле поиска с запасом 6 px по краям
  expect(Math.abs(holeBox!.x - (searchBox!.x - 6))).toBeLessThan(2);
  expect(Math.abs(holeBox!.width - (searchBox!.width + 12))).toBeLessThan(2);
  await page.screenshot({ path: 'test-results/product-tour-2-search.png' });

  await tour.getByRole('button', { name: 'Далее' }).click();
  await expect(tour.getByRole('heading', { name: 'Работа с гостями' })).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/product-tour-3-guests.png' });

  // Назад работает, Escape закрывает и ставит отметку
  await tour.getByRole('button', { name: 'Назад' }).click();
  await expect(tour.getByRole('heading', { name: 'Поиск по всей стойке' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tour).toBeHidden();

  await page.reload();
  await page.waitForTimeout(1200);
  await expect(page.getByTestId('product-tour')).toBeHidden();

  // повтор — из меню профиля
  await page.getByRole('button', { name: 'Меню администратора' }).click();
  await page.getByTestId('tour-restart').click();
  await expect(page.getByTestId('product-tour').getByRole('heading', { name: 'Добро пожаловать в WETOP' })).toBeVisible();
});

test('последний шаг — профиль, «Начать работу» закрывает обучение', async ({ page }) => {
  await signIn(page);
  const tour = page.getByTestId('product-tour');
  await expect(tour.getByRole('heading', { name: 'Добро пожаловать в WETOP' })).toBeVisible();
  for (let i = 0; i < 20; i += 1) {
    const next = tour.getByRole('button', { name: 'Далее' });
    if (!(await next.isVisible())) break;
    await next.click();
  }
  await expect(tour.getByRole('heading', { name: 'Профиль и выход' })).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/product-tour-4-profile.png' });
  await tour.getByRole('button', { name: 'Начать работу' }).click();
  await expect(tour).toBeHidden();
});

test('на телефоне шаги меню без подсветки — окно по центру, ничего не уезжает за край', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  const tour = page.getByTestId('product-tour');
  await expect(tour.getByRole('heading', { name: 'Добро пожаловать в WETOP' })).toBeVisible();
  await tour.getByRole('button', { name: 'Далее' }).click();
  const card = page.locator('.tour__card');
  await page.waitForTimeout(400); // перемещение карточки к шагу — 180 мс
  const box = await card.boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 390).toBe(true);
  await page.screenshot({ path: 'test-results/product-tour-5-mobile.png' });
});
