import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { FIXTURE_API, expect, test } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Вход в раздел «ИИ-агенты» (S0, plans/ai-agents-wetop-support-2026-09-29.md; решение владельца 29.09, Q-A2) и его
 * каталог (SA1, plans/business-ai-seller-v2-2026-09-29.md §8): состояние расширения, карточки со статусом, Business,
 * Location и каналами, кнопка по состоянию (SA2: видна всегда, при невозможности — неактивна с причиной от сервера, plans/
 * business-ai-seller-sa2-2026-09-30.md §4). Партнёр видит AI-продавца; карточка WETOP Support — только у главного
 * администратора. Старый адрес `/ai-seller` работает. Стенд — `scripts/preview/fixture-api.ts`.
 */
const API = FIXTURE_API;
// снимки SA1 (`reports/business-ai-seller-sa1-2026-09-29/`) остаются как были; каталог с новой кнопкой снимается в отчёт SA2
const SHOTS = 'reports/unified-sections-2026-10-01/agents';

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

async function signIn(page: Page) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/finance');
}

test('партнёр: пункт меню «ИИ-агенты», на входе только AI-продавец', async ({ page }) => {
  await signIn(page);
  const sidebar = page.locator('.workspace-header .topmenu');
  await sidebar.getByRole('button', { name: 'Продажи', exact: true }).click();
  await sidebar.getByRole('link', { name: 'ИИ-продавцы', exact: true }).click();
  await expect(page).toHaveURL(/\/ai-agents$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ИИ-продавцы');
  const seller = page.getByTestId('agent-seller');
  await expect(seller).toContainText('AI-продавец');
  // карточка пересобрана (89b2474): вместо меток «Продажи»/«Hospitality» — Business · Location и каналы
  await expect(seller).toContainText('Сеть Тест');
  await expect(seller).toContainText('Алматы');
  await expect(page.getByTestId('agent-support')).toHaveCount(0);
  await expect(page.getByText('WETOP Support')).toHaveCount(0);
  await seller.getByRole('link', { name: 'Открыть' }).click();
  await expect(page).toHaveURL(/\/ai-seller/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ИИ-продавец');
  // страницы продавца подсвечивают тот же пункт меню; список группы закрыт, пункт скрыт
  // от дерева доступности — ищем по CSS, как top-menu.spec
  await expect(sidebar.locator('a[aria-current="page"]')).toHaveText('ИИ-продавцы');
});

test('главный администратор: к техподдержке — переключателем агентов на «ИИ-продавце»', async ({
  page,
  request,
}) => {
  // карточку WETOP Support из каталога сняли (89b2474): вход администратора — ссылка «Техподдержка»
  // рядом с «Все агенты» на /ai-seller; в каталоге карточки нет и у администратора
  await request.post(`${API}/__test/control`, { data: { platformAdmin: true } });
  await signIn(page);
  await page.goto('/ai-agents');
  await expect(page.getByTestId('agent-support')).toHaveCount(0);
  await page.goto('/ai-seller');
  await page.getByRole('link', { name: 'Техподдержка', exact: true }).click();
  await expect(page).toHaveURL(/\/platform\/support/);
});

test('расширение не подключено: карточка объясняет, кнопка создания неактивна, ссылка ведёт на страницу с объяснением', async ({
  page,
  request,
}) => {
  await request.post(`${API}/__test/control`, { data: { sellerExtension: 'off' } });
  await signIn(page);
  await page.goto('/ai-agents');
  const seller = page.getByTestId('agent-seller');
  await expect(seller).toContainText('Автоматизируйте ответы гостям, подбор размещения и продажи');
  await expect(page.getByTestId('agent-seller-off')).toContainText('не подключено');
  // карточки продавца, статуса и «Открыть» без расширения нет
  await expect(page.getByTestId('agent-status')).toHaveCount(0);
  await expect(seller.getByRole('link', { name: 'Открыть' })).toHaveCount(0);
  // кнопка создания видна, но неактивна: расширения нет; рядом — путь к странице с объяснением
  const add = page.getByTestId('agent-add');
  await expect(add.getByRole('button', { name: '+ Подключить AI-продавца' })).toBeDisabled();
  await expect(add).toContainText('Расширение «ИИ-продавец» не подключено.');
  await add.getByRole('link', { name: 'Как подключить расширение', exact: true }).click();
  await expect(page).toHaveURL(/\/ai-seller$/);
  await expect(page.getByTestId('seller-extension-off')).toBeVisible();
});

test('срок расширения вышел: карточка остаётся, «Подписка не активна», кнопка создания неактивна', async ({
  page,
  request,
}) => {
  await request.post(`${API}/__test/control`, {
    data: { sellerExtension: 'expired', sellerApplied: true },
  });
  await signIn(page);
  await page.goto('/ai-agents');
  await expect(page.getByTestId('agent-seller-off')).toHaveCount(0);
  const seller = page.getByTestId('agent-seller');
  await expect(seller.getByTestId('agent-status')).toHaveText('Подписка не активна');
  await expect(seller.getByRole('link', { name: 'Открыть' })).toBeVisible();
  const add = page.getByTestId('agent-add');
  await expect(add.getByRole('button', { name: '+ Подключить AI-продавца' })).toBeDisabled();
  await expect(add).toContainText('Срок расширения «ИИ-продавец» вышел.');
  await expect(
    add.getByRole('link', { name: 'Как подключить расширение', exact: true }),
  ).toBeVisible();
});

test('действует, профиль не применён: «Не настроен», Business и Location объекта, единственный филиал занят', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/ai-agents');
  const seller = page.getByTestId('agent-seller');
  await expect(seller.getByTestId('agent-status')).toHaveText('Не настроен');
  await expect(seller).toContainText('Сеть Тест · Алматы');
  // единственный филиал занят рабочим продавцом: создать второго нельзя, кнопка видна и объясняет почему
  const add = page.getByTestId('agent-add');
  await expect(add.getByRole('button', { name: '+ Подключить AI-продавца' })).toBeDisabled();
  await expect(add).toContainText(
    'Нет свободного филиала. Для этого филиала AI-продавец уже создан.',
  );
});

test('продавец работает: статус, каналы по данным, создать ещё нельзя — причина словами', async ({
  page,
  request,
}) => {
  await request.post(`${API}/__test/control`, {
    data: { sellerApplied: true, sellerWhatsApp: 'on' },
  });
  await signIn(page);
  await page.goto('/ai-agents');
  const seller = page.getByTestId('agent-seller');
  await expect(seller.getByTestId('agent-status')).toHaveText('Профиль сохранён');
  const channels = seller.getByTestId('agent-channels');
  await expect(channels).toContainText('Сайт');
  await expect(channels).toContainText('Домены заданы');
  await expect(channels).toContainText('WhatsApp');
  await expect(channels).toContainText('Подключён');
  const add = page.getByTestId('agent-add');
  const button = add.getByRole('button', { name: '+ Подключить AI-продавца' });
  await expect(button).toBeDisabled();
  await expect(add).toContainText(
    'Нет свободного филиала. Для этого филиала AI-продавец уже создан.',
  );
  // причина связана с кнопкой для читалки экрана
  await expect(button).toHaveAccessibleDescription(/Нет свободного филиала/);
});

test('бот не ответил: страница жива, WhatsApp — «Нет данных»', async ({ page, request }) => {
  await request.post(`${API}/__test/control`, {
    data: { sellerApplied: true, sellerWhatsApp: 'unknown' },
  });
  await signIn(page);
  await page.goto('/ai-agents');
  const channels = page.getByTestId('agent-seller').getByTestId('agent-channels');
  await expect(channels).toContainText('Нет данных');
  await expect(page.getByTestId('agent-seller').getByTestId('agent-status')).toHaveText('Проверьте подключение');
});

test('черновики гостевого мастера: «Черновик», без Business и Location', async ({
  page,
  request,
}) => {
  await request.post(`${API}/__test/control`, { data: { sellerDrafts: ['Мой хостел'] } });
  await signIn(page);
  await page.goto('/ai-agents');
  const draft = page.getByTestId('agent-draft');
  await expect(draft).toHaveCount(1);
  await expect(draft).toContainText('Мой хостел');
  await expect(draft.getByTestId('agent-status')).toHaveText('Черновик');
  await expect(draft).toContainText('Business и Location не выбраны');
  await expect(draft.getByTestId('agent-channels')).toHaveCount(0);
});

test('каталог не загрузился: экран остаётся, вместо карточек — сбой со следующим шагом', async ({
  page,
  request,
}) => {
  await request.post(`${API}/__test/control`, {
    data: { platformAdmin: true, sellerCatalogFails: true },
  });
  await signIn(page);
  await page.goto('/ai-agents');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ИИ-продавцы');
  const failure = page.getByTestId('agents-error');
  await expect(failure).toContainText('Не удалось загрузить агентов');
  await expect(failure.getByRole('button', { name: /Повторить/ })).toBeVisible();
  await expect(page.getByTestId('agent-seller')).toHaveCount(0);
  // карточки WETOP Support в каталоге больше нет (89b2474): вход администратора — с /ai-seller
  await expect(page.getByTestId('agent-support')).toHaveCount(0);
});

test('сотрудник смены видит список; кнопка создания видна, неактивна, причина про роль', async ({
  page,
  request,
}) => {
  await request.post(`${API}/__test/control`, {
    data: { role: 'STAFF', sellerApplied: true, sellerExtraLocation: true },
  });
  await signIn(page);
  await page.goto('/ai-agents');
  await expect(page.getByTestId('agent-seller').getByTestId('agent-status')).toHaveText('Профиль сохранён');
  const add = page.getByTestId('agent-add');
  await expect(add.getByRole('button', { name: '+ Подключить AI-продавца' })).toBeDisabled();
  await expect(add).toContainText('Создавать агентов могут владелец и управляющий.');
});

test('старый адрес /ai-seller работает', async ({ page }) => {
  await signIn(page);
  await page.goto('/ai-seller');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ИИ-продавец');
});

const SHOT_STATES = {
  working: { sellerApplied: true, sellerWhatsApp: 'on', sellerDrafts: ['Мой хостел'] },
  off: { sellerExtension: 'off' },
  expired: { sellerExtension: 'expired', sellerApplied: true },
  setup: {},
} as const;

for (const theme of ['light', 'dark'] as const) {
  for (const width of [1440, 390]) {
    for (const [state, control] of Object.entries(SHOT_STATES)) {
      test(`каталог: axe и снимок, ${state}, ${theme}, ${width}`, async ({ page, request }) => {
        await request.post(`${API}/__test/control`, {
          data: { platformAdmin: state === 'working', ...control },
        });
        await page.emulateMedia({ colorScheme: theme });
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        await signIn(page);
        await page.goto('/ai-agents');
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('ИИ-продавцы');
        await expect(page.getByTestId('agent-seller')).toBeVisible();
        const scan = await new AxeBuilder({ page }).analyze();
        expect(scan.violations.map((v) => v.id)).toEqual([]);
        // ни горизонтальной прокрутки страницы, ни обрезанной кнопки на телефоне
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
        mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({
          path: `${SHOTS}/agents-${state}-${theme}-${width}.png`,
          fullPage: true,
        });
      });
    }
  }
}
