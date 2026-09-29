import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Вход в раздел «ИИ-агенты» (S0, plans/ai-agents-wetop-support-2026-09-29.md; решение владельца 29.09, Q-A2).
 * Партнёр видит AI-продавца; карточка WETOP Support — только у главного администратора. Старый адрес `/ai-seller`
 * работает. Стенд — `scripts/preview/fixture-api.ts`, как в `platform-access.spec.ts`.
 */
const API = 'http://127.0.0.1:4311';
const SHOTS = 'reports/ai-agents-s0-2026-09-29';

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
  await expect(seller).toContainText('Продажи · Hospitality');
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

test('старый адрес /ai-seller работает', async ({ page }) => {
  await signIn(page);
  await page.goto('/ai-seller');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ИИ-продавец');
});

for (const theme of ['light', 'dark'] as const) {
  for (const width of [1440, 390]) {
    test(`вход в раздел: axe и снимок, ${theme}, ${width}`, async ({ page, request }) => {
      await request.post(`${API}/__test/control`, { data: { platformAdmin: true } });
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await signIn(page);
      await page.goto('/ai-agents');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('ИИ-агенты');
      const scan = await new AxeBuilder({ page }).analyze();
      expect(scan.violations.map((v) => v.id)).toEqual([]);
      mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: `${SHOTS}/agents-${theme}-${width}.png`, fullPage: true });
    });
  }
}
