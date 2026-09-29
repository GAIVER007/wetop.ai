import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Вход в раздел «ИИ-агенты» (S0, plans/ai-agents-wetop-support-2026-09-29.md; решение владельца 29.09, Q-A2) и его
 * каталог (SA1, plans/business-ai-seller-v2-2026-09-29.md §8): состояние расширения, карточки со статусом, Business,
 * Location и каналами, кнопка по состоянию. Партнёр видит AI-продавца; карточка WETOP Support — только у главного
 * администратора. Старый адрес `/ai-seller` работает. Стенд — `scripts/preview/fixture-api.ts`.
 */
const API = 'http://127.0.0.1:4311';
const SHOTS = 'reports/business-ai-seller-sa1-2026-09-29';

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
}

test('партнёр: пункт меню «ИИ-агенты», на входе только AI-продавец', async ({ page }) => {
  await signIn(page);
  const sidebar = page.locator('.workspace-sidebar');
  await sidebar.getByRole('button', { name: 'Продажи', exact: true }).click();
  await sidebar.getByRole('link', { name: 'ИИ-агенты', exact: true }).click();
  await expect(page).toHaveURL(/\/ai-agents$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ИИ-агенты');
  const seller = page.getByTestId('agent-seller');
  await expect(seller).toContainText('AI-продавец');
  await expect(seller).toContainText('Продажи');
  await expect(seller).toContainText('Hospitality');
  await expect(page.getByTestId('agent-support')).toHaveCount(0);
  await expect(page.getByText('WETOP Support')).toHaveCount(0);
  await seller.getByRole('link', { name: 'Открыть' }).click();
  await expect(page).toHaveURL(/\/ai-seller/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ИИ-продавец');
  // страницы продавца подсвечивают тот же пункт меню
  await expect(sidebar.getByRole('link', { name: 'ИИ-агенты', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('главный администратор: рядом с продавцом карточка WETOP Support', async ({ page, request }) => {
  await request.post(`${API}/__test/control`, { data: { platformAdmin: true } });
  await signIn(page);
  await page.goto('/ai-agents');
  const support = page.getByTestId('agent-support');
  await expect(support).toContainText('WETOP Support');
  await expect(support).toContainText('Техническая поддержка платформы');
  await expect(support).toContainText('Platform Agent');
  await support.getByRole('link', { name: 'Открыть' }).click();
  await expect(page).toHaveURL(/\/platform\/support/);
});

test('расширение не подключено: карточка объясняет, «Подключить» ведёт на страницу с объяснением', async ({ page, request }) => {
  await request.post(`${API}/__test/control`, { data: { sellerExtension: 'off' } });
  await signIn(page);
  await page.goto('/ai-agents');
  const seller = page.getByTestId('agent-seller');
  await expect(seller).toContainText('Автоматизируйте ответы гостям, подбор размещения и продажи');
  await expect(page.getByTestId('agent-seller-off')).toContainText('не подключено');
  // карточки продавца, статуса и «Открыть» без расширения нет
  await expect(page.getByTestId('agent-status')).toHaveCount(0);
  await expect(seller.getByRole('link', { name: 'Открыть' })).toHaveCount(0);
  await page.getByTestId('agent-add').getByRole('link', { name: 'Подключить', exact: true }).click();
  await expect(page).toHaveURL(/\/ai-seller$/);
  await expect(page.getByTestId('seller-extension-off')).toBeVisible();
});

test('срок расширения вышел: карточка остаётся, «Подписка не активна», «Возобновить»', async ({ page, request }) => {
  await request.post(`${API}/__test/control`, { data: { sellerExtension: 'expired', sellerApplied: true } });
  await signIn(page);
  await page.goto('/ai-agents');
  await expect(page.getByTestId('agent-seller-off')).toHaveCount(0);
  const seller = page.getByTestId('agent-seller');
  await expect(seller.getByTestId('agent-status')).toHaveText('Подписка не активна');
  await expect(seller.getByRole('link', { name: 'Открыть' })).toBeVisible();
  await expect(page.getByTestId('agent-add').getByRole('link', { name: 'Возобновить', exact: true })).toBeVisible();
});

test('действует, профиль не применён: «Не настроен», Business и Location объекта, «Настроить»', async ({ page }) => {
  await signIn(page);
  await page.goto('/ai-agents');
  const seller = page.getByTestId('agent-seller');
  await expect(seller.getByTestId('agent-status')).toHaveText('Не настроен');
  await expect(seller).toContainText('Сеть Тест · Алматы');
  await expect(page.getByTestId('agent-add').getByRole('link', { name: 'Настроить', exact: true })).toBeVisible();
});

test('продавец работает: статус, каналы по данным, второго завести нельзя — причина словами', async ({ page, request }) => {
  await request.post(`${API}/__test/control`, { data: { sellerApplied: true, sellerWhatsApp: 'on' } });
  await signIn(page);
  await page.goto('/ai-agents');
  const seller = page.getByTestId('agent-seller');
  await expect(seller.getByTestId('agent-status')).toHaveText('Работает');
  const channels = seller.getByTestId('agent-channels');
  await expect(channels).toContainText('Сайт');
  await expect(channels).toContainText('Домены заданы');
  await expect(channels).toContainText('WhatsApp');
  await expect(channels).toContainText('Подключён');
  const add = page.getByTestId('agent-add');
  const button = add.getByRole('button', { name: '+ Подключить AI-продавца' });
  await expect(button).toBeDisabled();
  await expect(add).toContainText('В организации пока один AI-продавец');
  // причина связана с кнопкой для читалки экрана
  await expect(button).toHaveAccessibleDescription(/один AI-продавец/);
});

test('бот не ответил: страница жива, WhatsApp — «Нет данных»', async ({ page, request }) => {
  await request.post(`${API}/__test/control`, { data: { sellerApplied: true, sellerWhatsApp: 'unknown' } });
  await signIn(page);
  await page.goto('/ai-agents');
  const channels = page.getByTestId('agent-seller').getByTestId('agent-channels');
  await expect(channels).toContainText('Нет данных');
  await expect(page.getByTestId('agent-seller').getByTestId('agent-status')).toHaveText('Работает');
});

test('черновики гостевого мастера: «Черновик», без Business и Location', async ({ page, request }) => {
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

test('каталог не загрузился: экран остаётся, вместо карточек — сбой со следующим шагом', async ({ page, request }) => {
  await request.post(`${API}/__test/control`, { data: { platformAdmin: true, sellerCatalogFails: true } });
  await signIn(page);
  await page.goto('/ai-agents');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ИИ-агенты');
  const failure = page.getByTestId('agents-error');
  await expect(failure).toContainText('Не удалось загрузить агентов');
  await expect(failure.getByRole('button', { name: /Повторить/ })).toBeVisible();
  await expect(page.getByTestId('agent-seller')).toHaveCount(0);
  // соседний агент платформы не зависит от каталога партнёра
  await expect(page.getByTestId('agent-support')).toBeVisible();
});

test('сотрудник смены видит список, но без кнопок', async ({ page, request }) => {
  await request.post(`${API}/__test/control`, { data: { role: 'STAFF', sellerApplied: true } });
  await signIn(page);
  await page.goto('/ai-agents');
  await expect(page.getByTestId('agent-seller').getByTestId('agent-status')).toHaveText('Работает');
  await expect(page.getByTestId('agent-add')).toHaveCount(0);
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
        await request.post(`${API}/__test/control`, { data: { platformAdmin: state === 'working', ...control } });
        await page.emulateMedia({ colorScheme: theme });
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        await signIn(page);
        await page.goto('/ai-agents');
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('ИИ-агенты');
        await expect(page.getByTestId('agent-seller')).toBeVisible();
        const scan = await new AxeBuilder({ page }).analyze();
        expect(scan.violations.map((v) => v.id)).toEqual([]);
        // ни горизонтальной прокрутки страницы, ни обрезанной кнопки на телефоне
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
        mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({ path: `${SHOTS}/agents-${state}-${theme}-${width}.png`, fullPage: true });
      });
    }
  }
}
