import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { expect, test } from './fixtures';
import type { APIRequestContext, Page } from '@playwright/test';

/**
 * Кабинет техподдержки, S3 (plans/ai-agents-s3-knowledge-2026-09-29.md): каталог управляемой базы знаний, правка,
 * публикация с подтверждением, «На основании» у диалога, черновик из закрытого обращения. Только главный
 * администратор. Стенд — `scripts/preview/fixture-api.ts`; всё вымышленное.
 */
const API = 'http://127.0.0.1:4311';
const SIGNED = '6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const CLOSED = '9d4e5f6a-7b8c-4d9e-9f0a-2b3c4d5e6f7a';
const SHOTS = 'reports/ai-agents-s3-2026-09-29';

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

async function signIn(page: Page) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
}
const control = (request: APIRequestContext, body: Record<string, unknown>) =>
  request.post(`${API}/__test/control`, { data: body });
async function admin(page: Page, request: APIRequestContext) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await control(request, { platformAdmin: true });
}
async function shot(page: Page, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}
const catalog = (page: Page) => page.getByRole('main').getByTestId('kb-catalog');

test('каталог: чипы статусов с числами, строки с категорией, видимостью, версией; отбор по статусу', async ({
  page,
  request,
}) => {
  await admin(page, request);
  await page.goto('/platform/support/base');
  await expect(
    page
      .getByRole('navigation', { name: 'Техподдержка' })
      .getByRole('link', { name: 'База знаний' }),
  ).toHaveAttribute('aria-current', 'page');
  const rows = catalog(page).getByRole('row');
  await expect(rows).toHaveCount(4); // шапка + три записи стенда
  await expect(catalog(page)).toContainText('Как изменить время заезда');
  await expect(catalog(page)).toContainText('Отвечает');
  await expect(catalog(page)).toContainText('Только администратор платформы');
  const chips = page.getByRole('main').getByRole('navigation', { name: 'Статусы знаний' });
  await expect(chips).toContainText('Черновик');
  await chips.getByRole('link', { name: /Черновик/ }).click();
  await expect(catalog(page).getByRole('row')).toHaveCount(2);
  await expect(catalog(page)).toContainText('Режим «только чтение»');
  await shot(page, 'catalog-1440');
});

test('не главный администратор: раздела нет, данных базы знаний не видно', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto('/platform/support/base');
  await expect(page.getByTestId('support-forbidden')).toBeVisible();
  await expect(page.getByTestId('kb-catalog')).toHaveCount(0);
});

test('запись: правка активной уводит в черновик, публикация — с подтверждением и автором из сессии', async ({
  page,
  request,
}) => {
  await admin(page, request);
  await page.goto('/platform/support/base?status=ACTIVE');
  await catalog(page).getByRole('link', { name: 'Как изменить время заезда' }).click();
  const panel = page.getByTestId('kb-entry');
  await expect(panel).toContainText('Версия 2');
  await expect(panel).toContainText('Отвечает');
  await panel
    .getByLabel('Текст знания')
    .fill('Настройки объекта → Проживание: время заезда пишется в 24 часах, например 14:00.');
  await panel.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByTestId('kb-result')).toContainText('Сохранено');
  await expect(panel).toContainText('Черновик');
  await expect(panel).toContainText('Версия 3');
  await expect(panel).toContainText('Ответов по этой записи пока нет: опубликуйте её');

  await panel.getByRole('button', { name: 'Опубликовать' }).click();
  const confirm = page.getByRole('dialog');
  await expect(confirm).toContainText('Опубликовать знание?');
  await confirm.getByRole('button', { name: 'Опубликовать' }).click();
  await expect(page.getByTestId('kb-result')).toContainText('Опубликовано');
  await expect(panel).toContainText('Отвечает');
  await expect(panel).toContainText('Утвердил');
  await shot(page, 'entry-published-1440');
});

test('публикация отменяется: без «да» запись остаётся черновиком', async ({ page, request }) => {
  await admin(page, request);
  await page.goto('/platform/support/base?status=DRAFT');
  await catalog(page)
    .getByRole('link', { name: /только чтение/ })
    .click();
  const panel = page.getByTestId('kb-entry');
  await panel.getByRole('button', { name: 'Опубликовать' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Не публиковать' }).click();
  await expect(panel).toContainText('Черновик');
});

test('создание записи: пустое название — ошибка у формы, ввод остаётся; верное — черновик', async ({
  page,
  request,
}) => {
  await admin(page, request);
  await page.goto('/platform/support/base?new=1');
  const form = page.getByTestId('kb-entry');
  await form.getByLabel('Текст знания').fill('Симптом: …');
  await form.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByTestId('kb-error')).toBeVisible();
  await expect(form.getByLabel('Текст знания')).toHaveValue('Симптом: …');
  await form.getByLabel('Название').fill('Как закрыть смену');
  await form.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByTestId('kb-result')).toContainText('Сохранено');
  await expect(page.getByTestId('kb-entry')).toContainText('Черновик');
});

test('«На основании» у диалога — для оператора; из закрытого обращения — черновик знания', async ({
  page,
  request,
}) => {
  await admin(page, request);
  await page.goto(`/platform/support?id=${SIGNED}`);
  const sources = page.getByTestId('kb-sources');
  await expect(sources).toContainText('На основании');
  await expect(sources).toContainText('Как изменить время заезда');
  await expect(sources).toContainText('версия 2');

  await page.goto(`/platform/support?queue=closed&id=${CLOSED}`);
  await expect(page.getByTestId('kb-sources')).toContainText('Знания в ответах не использовались');
  await page.getByRole('button', { name: 'Создать знание из обращения' }).click();
  await expect(page.getByTestId('kb-draft-result')).toContainText('Черновик создан');
  await page.getByRole('link', { name: 'Открыть черновик' }).click();
  await expect(page.getByTestId('kb-entry')).toContainText('Черновик');
  await expect(page.getByTestId('kb-entry')).toContainText('Знание из обращения');
  await shot(page, 'draft-from-conversation-1440');
});

test('у открытого обращения кнопки «Создать знание» нет', async ({ page, request }) => {
  await admin(page, request);
  await page.goto(`/platform/support?id=${SIGNED}`);
  await expect(page.getByRole('button', { name: 'Создать знание из обращения' })).toHaveCount(0);
});

for (const theme of ['light', 'dark'] as const) {
  for (const width of [1440, 390]) {
    test(`каталог и запись: axe и снимок, ${theme}, ${width}`, async ({ page, request }) => {
      await admin(page, request);
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.goto('/platform/support/base');
      await expect(catalog(page)).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
      await shot(page, `catalog-${theme}-${width}`);
      await page.getByRole('main').getByTestId('kb-catalog').getByRole('link').first().click();
      await expect(page.getByTestId('kb-entry')).toBeVisible();
      // заголовок вкладки ставится после перехода: axe без него видит «document-title»
      await expect(page).toHaveTitle(/.+/);
      expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
      await shot(page, `entry-${theme}-${width}`);
    });
  }
}

test('«Действия агента» у диалога (S6): выполненное и переданное человеку словами; у диалога без действий блока нет', async ({
  page,
  request,
}) => {
  await admin(page, request);
  await page.goto(`/platform/support?id=${SIGNED}`);
  const journal = page.getByTestId('agent-actions');
  await expect(journal).toContainText('Действия агента');
  await expect(journal).toContainText('Подтянуть ленту каналов');
  await expect(journal).toContainText('Выполнено');
  await expect(journal).toContainText('Возврат оплаты');
  await expect(journal).toContainText('Передано человеку');
  // снимок S6 — в отчёт S6, не S3
  mkdirSync('reports/ai-agents-s6-2026-09-29', { recursive: true });
  await page.screenshot({
    path: 'reports/ai-agents-s6-2026-09-29/agent-actions-1440.png',
    fullPage: true,
  });
  await page.goto(`/platform/support?queue=closed&id=${CLOSED}`);
  await expect(page.getByTestId('agent-actions')).toHaveCount(0);
});
