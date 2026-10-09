import { FIXTURE_API, expect, test, type Page } from './fixtures';

/**
 * Пробный период 14 дней и «только чтение» после него (Q-144 — Б, Q-141 — А, ADR-102). Стойка показывает полосу на
 * каждом экране, вход не закрыт; главный администратор подтверждает оплату в «Платформа → Организации».
 * Сам запрет записи проверяет API (`apps/api/src/auth/auth.guard.test.ts`), здесь — что видит человек.
 */
const API = FIXTURE_API;

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

async function signIn(page: Page) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
}

test('пробный срок вышел — полоса «оплатите подписку» на рабочих экранах; в срок её нет', async ({
  page,
  request,
}) => {
  await request.post(`${API}/__test/control`, { data: { orgTrialDays: 10 } });
  await signIn(page);
  await expect(page.getByTestId('read-only-banner')).toHaveCount(0);

  await request.post(`${API}/__test/control`, { data: { orgTrialDays: 'ended' } });
  for (const path of ['/today', '/chessboard', '/reservations', '/guests']) {
    await page.goto(path);
    const banner = page.getByTestId('read-only-banner');
    await expect(banner).toContainText('Пробный период закончился, оплатите подписку');
    await expect(banner).toContainText('Данные доступны для просмотра');
  }
  // «Гости» после срока читаются целиком: список со счётчиками, поиск, карточка и документы;
  // запись держит общий запрет API по методу (auth.guard.test.ts) — своей trial-логики у гостей нет
  await page.goto('/guests');
  const main = page.getByRole('main');
  await expect(main.getByTestId('guests-meta')).toBeVisible();
  await expect(main.getByLabel('Поиск гостей')).toBeVisible();
  // ТЗ §40: бронь после срока не создать — действие не рисуется (общий флаг оболочки, как на «Бронях»)
  await expect(main.getByRole('link', { name: 'Новая бронь' })).toHaveCount(0);
  // панель справа открыта на первом госте (чтение): действий записи в ней нет, из неё ведёт ссылка в полную карточку
  const panel = main.getByTestId('guest-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('link', { name: 'Новая бронь' })).toHaveCount(0);
  await expect(main.getByRole('toolbar', { name: 'Действия с отмеченными' }).getByText(/Заселить|Выселить/)).toHaveCount(0);
  await panel.getByRole('tab', { name: 'История', exact: true }).click();
  await panel.getByRole('link', { name: 'Открыть гостя', exact: true }).click();
  await expect(page).toHaveURL(/\/guests\//);
  await expect(main.getByTestId('guest-head')).toBeVisible();
  // G4: карточка читается целиком — история проживаний на месте; «Редактировать» и «Новая бронь» не рисуются
  await expect(main.getByRole('link', { name: 'Редактировать', exact: true })).toHaveCount(0);
  await expect(main.getByRole('link', { name: 'Новая бронь' })).toHaveCount(0);
  await main.getByRole('tab', { name: 'Проживания', exact: true }).click();
  await expect(main.getByRole('tabpanel').getByTestId('guest-stay-row').first()).toBeVisible();
  // G5 (ТЗ §40): документы и финансы читаются; добавить и удалить документ, сохранить профиль — нельзя
  await main.getByRole('tab', { name: 'Документы', exact: true }).click();
  await expect(main.getByRole('tabpanel').getByTestId('document-row').first()).toBeVisible();
  await expect(main.getByTestId('document-form')).toHaveCount(0);
  await expect(main.getByRole('button', { name: 'удалить', exact: true })).toHaveCount(0);
  await main.getByRole('tab', { name: 'Финансы', exact: true }).click();
  await expect(main.getByRole('tabpanel').getByTestId('guest-finance-summary')).toBeVisible();
  await main.getByRole('tab', { name: 'Данные гостя', exact: true }).click();
  await expect(main.getByTestId('guest-form')).toBeVisible();
  await expect(main.getByRole('button', { name: 'Сохранить', exact: true })).toHaveCount(0);
  await page.goto('/today');
  await page.screenshot({ path: 'test-results/trial-read-only-banner.png' });
});

test('главный администратор: «Оплата получена» — организация работает; «Только чтение» — обратно', async ({
  page,
  request,
}) => {
  await request.post(`${API}/__test/control`, { data: { platformAdmin: true } });
  await signIn(page);
  await page.goto('/platform?org=ui-org-2');
  const form = page.getByTestId('platform-status-form');
  await expect(form).toBeVisible();
  // пробного периода организации в разделе нет: стоит «работает» (расширения «ИИ-продавец» и сайта живут отдельно)
  await expect(page.getByTestId('platform-organization')).toContainText('работает');
  await form.getByTestId('platform-status-readonly').click();
  await expect(page.getByTestId('platform-organization')).toContainText('только чтение');

  await form.getByLabel('Заметка — номер счёта').fill('Счёт № 1, WETOP Core');
  await form.getByTestId('platform-status-active').click();
  await expect(form.getByTestId('platform-status-result')).toContainText('Оплата подтверждена');
  await expect(page.getByTestId('platform-organization')).toContainText('работает');
  await page.screenshot({ path: 'test-results/trial-platform-paid.png', fullPage: true });
});

