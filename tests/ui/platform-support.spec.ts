import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import type { APIRequestContext, Page } from '@playwright/test';

/**
 * «Платформа → Техподдержка» (ADR-083, план `plans/platform-roles-extensions-2026-09-25.md` Э3): диалоги ИИ-помощника,
 * его знания и сводка — только главному администратору. Стенд (`scripts/preview/fixture-api.ts`) отвечает так же, как
 * API: панель помощника за ним, кто пишет — из подписи стойки. Все, кто пишет, вымышленные (ADR-010).
 */
const API = 'http://127.0.0.1:4311';
const SIGNED = '6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const ANONYMOUS = '7b2c3d4e-5f6a-4b7c-9d8e-0f1a2b3c4d5e';

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

const control = (request: APIRequestContext, body: Record<string, unknown>) =>
  request.post(`${API}/__test/control`, { data: body });

const menuLinks = (page: Page) =>
  page
    .locator('.workspace-sidebar .workspace-links a')
    .evaluateAll((items) => items.map((item) => item.getAttribute('href')));

/** Снимок для отчёта: без фокуса и с начала страницы — иначе закреплённые шапка и меню снимаются со сдвигом */
async function shot(page: Page, name: string) {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: `reports/platform-support-2026-09-25/${name}.png`,
    fullPage: true,
  });
}

test('не главный администратор: пункта нет, а страница говорит, чей это раздел', async ({
  page,
}) => {
  await signIn(page);
  await expect.poll(() => menuLinks(page)).toContain('/ai-seller');
  expect(await menuLinks(page)).not.toContain('/platform/support');
  // Техподдержка переехала под переключатель агентов на «ИИ-продавце» — не главному администратору его не видно
  await page.goto('/ai-seller');
  await expect(page.getByRole('link', { name: 'Техподдержка' })).toHaveCount(0);
  await page.goto('/platform/support');
  await expect(page.getByTestId('support-forbidden')).toContainText('главного администратора');
  await expect(page.getByTestId('support-dialogs')).toHaveCount(0);
});

test('главный администратор: сводка, отбор, карточка — кто пишет; перехват, ответ, возврат', async ({
  page,
  request,
}) => {
  await signIn(page);
  await control(request, { platformAdmin: true });
  await page.goto('/today');
  expect(await menuLinks(page)).not.toContain('/platform/support');
  // Своего пункта меню у техподдержки больше нет — до неё главный администратор доходит переключателем
  // агентов на «ИИ-продавце» (перенос раздела под общую навигацию ботов)
  await page.goto('/ai-seller');
  await page.getByRole('link', { name: 'Техподдержка' }).click();
  await page.waitForURL('**/platform/support');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Техподдержка');
  await expect(main.getByTestId('support-summary')).toContainText('Диалогов за сутки');
  const table = main.getByTestId('support-dialogs');
  await expect(table.getByRole('row')).toHaveCount(3);
  await expect(table).toContainText('d***');
  await expect(table).toContainText('Без подписи');

  await main
    .getByRole('navigation', { name: 'Отбор диалогов' })
    .getByRole('link', { name: 'Нужен человек' })
    .click();
  await expect(page).toHaveURL(/mode=needs_human/);
  await expect(table.getByRole('row')).toHaveCount(2);

  await table.getByRole('link', { name: 'd***' }).click();
  const card = main.getByTestId('support-dialog-card');
  await expect(card.getByRole('heading', { level: 2 })).toHaveText('dana@example.invalid');
  const who = card.getByTestId('support-dialog-who');
  await expect(who.getByRole('link', { name: 'Luxx Aparts' })).toHaveAttribute(
    'href',
    '/platform?org=ui-org',
  );
  // роль словом стойки: «сотрудник» стал «администратором» (ADR-100)
  await expect(who).toContainText('администратор');
  await expect(card).toContainText('Не сохраняется бронь');
  await shot(page, 'support-dialog');

  await card.getByTestId('dialog-takeover').click();
  await expect(card.getByTestId('dialog-mode-result')).toHaveText(
    'Диалог ваш: помощник молчит, пока вы не вернёте его боту.',
  );
  await card.getByLabel('Ответ пользователю').fill('Проверим за десять минут.');
  await card.getByTestId('dialog-reply').click();
  await expect(card.getByTestId('dialog-reply-result')).toHaveText('Ответ отправлен.');
  await page.reload();
  await expect(main.getByTestId('support-dialog-card')).toContainText('Проверим за десять минут.');
  await expect(main.getByTestId('support-dialog-mode')).toHaveText('ведёт человек');
  await main.getByTestId('support-dialog-card').getByTestId('dialog-release').click();
  await expect(
    main.getByTestId('support-dialog-card').getByTestId('dialog-mode-result'),
  ).toHaveText('Диалог вернули помощнику.');

  // без входа, с главной wetop.ai: подписи нет — так и сказано
  await page.goto(`/platform/support?id=${ANONYMOUS}`);
  await expect(
    main.getByTestId('support-dialog-card').getByRole('heading', { level: 2 }),
  ).toHaveText('Посетитель без входа');
  await expect(main.getByTestId('support-dialog-card')).toContainText('подписи стойки нет');
});

test('знания помощника: список и загрузка документа', async ({ page, request }) => {
  await signIn(page);
  await control(request, { platformAdmin: true });
  await page.goto('/platform/support/knowledge');
  const main = page.getByRole('main');
  await expect(main.getByTestId('support-knowledge')).toContainText('справочник-ошибок.md');
  await main.getByTestId('knowledge-file').setInputFiles({
    name: 'коды-ошибок.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Коды ошибок\nAPI_503 — нет связи с API'),
  });
  await main.getByTestId('knowledge-upload').click();
  await expect(main.getByTestId('knowledge-result')).toHaveText(
    'Загружено: «коды-ошибок.md», частей 1.',
  );
  await page.reload();
  await expect(main.getByTestId('support-knowledge')).toContainText('коды-ошибок.md');
  await shot(page, 'support-knowledge');
});

test('настройка помощника: правила и модель сохраняются, «Проверка» отвечает по новым правилам', async ({
  page,
  request,
}) => {
  await signIn(page);
  await control(request, { platformAdmin: true });
  const main = page.getByRole('main');
  const ask = async (text: string) => {
    await main.getByTestId('sandbox-text').fill(text);
    await main.getByTestId('sandbox-send').click();
  };

  // до правки помощник на «вы»
  await page.goto('/platform/support/check');
  await ask('Привет');
  await expect(main.getByTestId('sandbox-history')).toContainText(
    'Помощник: Здравствуйте! Чем помочь?',
  );

  await page.goto('/platform/support/settings');
  const rules = main.getByTestId('support-prompt-text');
  await expect(rules).toHaveValue(/Отвечай на «вы»/);
  await rules.fill('Ты — ИИ-помощник WETOP. Отвечай на «ты», коротко.');
  await main.getByTestId('support-prompt-save').click();
  await expect(main.getByTestId('support-prompt-result')).toContainText('Сохранено: 49 знаков');
  await page.reload();
  await expect(main.getByTestId('support-prompt-text')).toHaveValue(
    'Ты — ИИ-помощник WETOP. Отвечай на «ты», коротко.',
  );

  await main.getByTestId('support-model-form').getByLabel('Модель').selectOption('модель-б');
  await main.getByTestId('support-model-save').click();
  await expect(main.getByTestId('support-model-result')).toHaveText(
    'Модель: модель-б (была модель-а).',
  );
  await shot(page, 'support-settings');

  // правила дошли до помощника: теперь на «ты»
  await page.goto('/platform/support/check');
  await ask('Привет');
  await expect(main.getByTestId('sandbox-history')).toContainText('Помощник: Привет! Чем помочь?');
  await shot(page, 'support-check');
});

test('правил у помощника ещё нет — «Настройки» предупреждают, что он не отвечает', async ({
  page,
  request,
}) => {
  await signIn(page);
  await control(request, { platformAdmin: true, supportPromptEmpty: true });
  await page.goto('/platform/support/settings');
  const main = page.getByRole('main');
  await expect(main.getByTestId('support-prompt-missing')).toContainText(
    'помощник сейчас не отвечает',
  );
  await expect(main.getByTestId('support-prompt-missing')).toContainText(
    'sistemnyy-prompt-pomoshchnik.md',
  );
  await expect(main.getByTestId('support-prompt-text')).toHaveValue('');
});

test('помощник не подключён — раздел говорит, что вписать владельцу', async ({ page, request }) => {
  await signIn(page);
  await control(request, { platformAdmin: true, supportState: 'not-configured' });
  await page.goto('/platform/support');
  await expect(page.getByTestId('support-not-configured')).toContainText('ASSISTANT_PANEL_URL');
  await expect(page.getByTestId('support-not-configured')).toContainText('SELLER_SERVICE_KEY');
});

for (const width of [1440, 390]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`доступность «Техподдержки»: ${theme}, ${width}px`, async ({ page, request }) => {
      test.setTimeout(120_000);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height: 1000 });
      await signIn(page);
      await control(request, { platformAdmin: true });
      for (const route of [
        `/platform/support?id=${SIGNED}`,
        `/platform/support?id=${ANONYMOUS}`,
        '/platform/support/knowledge',
        '/platform/support/settings',
        '/platform/support/check',
      ]) {
        await page.goto(route);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        const result = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect
          .soft(
            result.violations.map((v) => ({
              id: v.id,
              nodes: v.nodes.slice(0, 3).map((n) => n.target),
            })),
            route,
          )
          .toEqual([]);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect.soft(overflow, `${route}: страница шире окна`).toBeLessThanOrEqual(1);
      }
    });
  }
}
