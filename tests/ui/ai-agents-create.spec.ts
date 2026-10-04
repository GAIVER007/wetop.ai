import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { FIXTURE_API, expect, test } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Создание AI-продавца (SA2, plans/business-ai-seller-sa2-2026-09-30.md): один экран вместо мастера, черновик и страница
 * его состояния. Что проверяется: форма и ошибки словами у поля, занятый филиал виден и не выбирается, повторная отправка не
 * даёт второго агента, страница агента без фальшивых шагов, кнопка и форма для разных ролей и режимов, оформление в двух темах
 * и на телефоне. Запись в базу и права сервера доказывают API-тесты; стенд, `scripts/preview/fixture-api.ts`.
 */
const API = FIXTURE_API;
const SHOTS = 'reports/unified-sections-2026-10-01/create-agent';
const FREE = { sellerApplied: true, sellerExtraLocation: true };

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

const control = (
  request: import('@playwright/test').APIRequestContext,
  data: Record<string, unknown>,
) => request.post(`${API}/__test/control`, { data });

test('свободный филиал: кнопка активна, форма создаёт черновик, страница агента показывает состояние', async ({
  page,
  request,
}) => {
  await control(request, FREE);
  await signIn(page);
  await page.goto('/ai-agents');
  const button = page
    .getByTestId('agent-add')
    .getByRole('link', { name: '+ Подключить AI-продавца' });
  await expect(button).toBeVisible();
  await button.click();
  await expect(page).toHaveURL(/\/ai-agents\/new$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Новый AI-продавец');
  // одна форма, а не шаги мастера: ни «Далее», ни номеров шагов
  await expect(page.getByRole('button', { name: /Далее/ })).toHaveCount(0);

  await page.getByTestId('agent-name').fill('AI-продавец Luxx 2');
  await expect(page.getByTestId('agent-business')).toHaveValue(
    'b0000000-0000-4000-8000-0000000000aa',
  );
  // занятый филиал стоит в списке и выбрать его нельзя, выбран свободный
  const busy = page.getByTestId('agent-location').locator('option', { hasText: 'Алматы' });
  await expect(busy).toHaveAttribute('disabled', '');
  await expect(busy).toHaveText('Алматы (занят)');
  await expect(page.getByTestId('agent-location')).toHaveValue(
    'c0000000-0000-4000-8000-0000000000ab',
  );
  await page.getByTestId('agent-create-submit').click();

  await expect(page).toHaveURL(/\/ai-agents\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('AI-продавец Luxx 2');
  await expect(page.getByText('Сеть Тест · Астана')).toBeVisible();
  await expect(page.getByTestId('agent-lifecycle')).toHaveText('Черновик');
  await expect(page.getByRole('navigation', { name: 'Шаги настройки агента' })).toBeVisible();
  await page
    .getByLabel('Ваш рассказ', { exact: true })
    .fill('Назови продавца Ася и отвечай коротко.');
  await page.getByRole('button', { name: 'Сгенерировать инструкцию', exact: true }).click();
  await expect(page.getByLabel('Предпросмотр инструкции')).toHaveValue(/Ты Ася/);
  await expect(page.getByLabel('Как агент должен отвечать')).toHaveValue('');
  await page.getByRole('button', { name: 'Использовать эту редакцию' }).click();
  await page.getByLabel('Как агент должен отвечать').fill('Проверенная тестовая инструкция Аси.');
  await page.getByRole('button', { name: 'Сохранить инструкцию', exact: true }).click();
  // на странице агента есть и статус Telegram-панели: берём именно сообщение о сохранении
  await expect(
    page.getByRole('status').filter({ hasText: 'Инструкция сохранена' }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Как агент должен отвечать')).toHaveValue(
    'Проверенная тестовая инструкция Аси.',
  );
  await page.getByRole('button', { name: /Ваш рассказ/ }).click();
  await page
    .getByLabel('Ваш рассказ', { exact: true })
    .fill('Повторная генерация не должна стереть инструкцию.');
  await page.getByRole('button', { name: 'Сгенерировать инструкцию', exact: true }).click();
  await page.getByRole('button', { name: 'Оставить текущую' }).click();
  await expect(page.getByLabel('Как агент должен отвечать')).toHaveValue(
    'Проверенная тестовая инструкция Аси.',
  );
  await expect(page.getByRole('button', { name: /Запустить|Активировать/ })).toHaveCount(0);
});

test('каталог после создания: карточка агента с Business · Location, кнопка снова неактивна', async ({
  page,
  request,
}) => {
  await control(request, FREE);
  await signIn(page);
  await page.goto('/ai-agents/new');
  await page.getByTestId('agent-name').fill('Второй продавец');
  await page.getByTestId('agent-create-submit').click();
  await page.waitForURL(/\/ai-agents\/[0-9a-f-]{36}$/);
  await page.goto('/ai-agents');
  const card = page.getByTestId('agent-created');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('Второй продавец');
  await expect(card).toContainText('Сеть Тест · Астана');
  await expect(card.getByTestId('agent-status')).toHaveText('Черновик');
  const add = page.getByTestId('agent-add');
  await expect(add.getByRole('button', { name: '+ Подключить AI-продавца' })).toBeDisabled();
  await expect(add).toContainText(
    'Нет свободного филиала. Во всех филиалах AI-продавец уже создан.',
  );
  await card.getByRole('link', { name: /Открыть/ }).click();
  await expect(page).toHaveURL(/\/ai-agents\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Второй продавец');
});

test('ошибки у поля словами: пустое название не отправляется и ничего не создаёт', async ({
  page,
  request,
}) => {
  await control(request, FREE);
  await signIn(page);
  await page.goto('/ai-agents/new');
  await page.getByTestId('agent-name').fill('   ');
  await page.getByTestId('agent-create-submit').click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Введите название агента.' }),
  ).toBeVisible();
  await expect(page.getByTestId('agent-name')).toHaveAttribute('aria-invalid', 'true');
  await expect(page).toHaveURL(/\/ai-agents\/new$/);
  await page.getByTestId('agent-name').fill('Не пустое');
  await page.getByTestId('agent-create-submit').click();
  await page.waitForURL(/\/ai-agents\/[0-9a-f-]{36}$/);
  await page.goto('/ai-agents');
  await expect(page.getByTestId('agent-created')).toHaveCount(1);
});

test('двойной щелчок по «Создать черновик» даёт одного агента', async ({ page, request }) => {
  await control(request, FREE);
  await signIn(page);
  await page.goto('/ai-agents/new');
  await page.getByTestId('agent-name').fill('Один агент');
  await page.getByTestId('agent-create-submit').dblclick();
  await page.waitForURL(/\/ai-agents\/[0-9a-f-]{36}$/);
  await page.goto('/ai-agents');
  await expect(page.getByTestId('agent-created')).toHaveCount(1);
});

test('единственный филиал занят: форма недоступна, причина словами, кнопки создания нет', async ({
  page,
  request,
}) => {
  await control(request, { sellerApplied: true });
  await signIn(page);
  await page.goto('/ai-agents/new');
  const blocked = page.getByTestId('agent-create-blocked');
  await expect(blocked).toContainText(
    'Нет свободного филиала. Для этого филиала AI-продавец уже создан.',
  );
  await expect(page.getByTestId('agent-create-form')).toHaveCount(0);
  await blocked.getByRole('link', { name: 'К списку агентов' }).click();
  await expect(page).toHaveURL(/\/ai-agents$/);
});

test('сотрудник смены: страница создания объясняет роль, формы нет', async ({ page, request }) => {
  await control(request, { ...FREE, role: 'STAFF' });
  await signIn(page);
  await page.goto('/ai-agents/new');
  await expect(page.getByTestId('agent-create-blocked')).toContainText(
    'Создавать агентов могут владелец и управляющий.',
  );
  await expect(page.getByTestId('agent-create-form')).toHaveCount(0);
});

test('управляющий может создать агента', async ({ page, request }) => {
  await control(request, { ...FREE, role: 'MANAGER' });
  await signIn(page);
  await page.goto('/ai-agents/new');
  await page.getByTestId('agent-name').fill('Агент управляющего');
  await page.getByTestId('agent-create-submit').click();
  await expect(page).toHaveURL(/\/ai-agents\/[0-9a-f-]{36}$/);
});

test('«только чтение»: кнопка в каталоге неактивна, форма недоступна', async ({
  page,
  request,
}) => {
  await control(request, { ...FREE, orgTrialDays: 'ended' });
  await signIn(page);
  await page.goto('/ai-agents');
  const add = page.getByTestId('agent-add');
  await expect(add.getByRole('button', { name: '+ Подключить AI-продавца' })).toBeDisabled();
  await page.goto('/ai-agents/new');
  await expect(page.getByTestId('agent-create-blocked')).toBeVisible();
  await expect(page.getByTestId('agent-create-form')).toHaveCount(0);
});

test('расширения нет: на странице создания причина про расширение', async ({ page, request }) => {
  await control(request, { sellerExtension: 'off' });
  await signIn(page);
  await page.goto('/ai-agents/new');
  await expect(page.getByTestId('agent-create-blocked')).toContainText(
    'Расширение «ИИ-продавец» не подключено.',
  );
});

test('несуществующий агент, страница «не найдено», а не пустая карточка', async ({
  page,
  request,
}) => {
  await control(request, FREE);
  await signIn(page);
  await page.goto('/ai-agents/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  // страница отдаётся потоком, поэтому код ответа уже 200: судим по тому, что видит человек
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Страница не найдена');
  await expect(page.getByTestId('agent-setup')).toHaveCount(0);
});

test('запуска нет и на сервере: маршрута activate нет, черновик остаётся черновиком', async ({
  page,
  request,
}) => {
  await control(request, FREE);
  await signIn(page);
  await page.goto('/ai-agents/new');
  await page.getByTestId('agent-name').fill('Черновик без запуска');
  await page.getByTestId('agent-create-submit').click();
  await page.waitForURL(/\/ai-agents\/[0-9a-f-]{36}$/);
  const id = page.url().split('/').pop()!;
  const answer = await request.post(`${API}/ai-seller/agents/${id}/activate`, {
    headers: { 'x-wetop-test-client': '1' },
  });
  expect(answer.status()).toBe(404);
  await page.reload();
  await expect(page.getByTestId('agent-lifecycle')).toHaveText('Черновик');
});

const VIEWS = ['form', 'agent', 'blocked'] as const;

for (const theme of ['light', 'dark'] as const) {
  for (const width of [1440, 390]) {
    for (const view of VIEWS) {
      test(`оформление: axe и снимок, ${view}, ${theme}, ${width}`, async ({ page, request }) => {
        await control(request, view === 'blocked' ? { sellerApplied: true } : FREE);
        await page.emulateMedia({ colorScheme: theme });
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        await signIn(page);
        if (view === 'agent') {
          await page.goto('/ai-agents/new');
          await page.getByTestId('agent-name').fill('AI-продавец Luxx 2');
          await page.getByTestId('agent-create-submit').click();
          await page.waitForURL(/\/ai-agents\/[0-9a-f-]{36}$/);
          await expect(
            page.getByRole('navigation', { name: 'Шаги настройки агента' }),
          ).toBeVisible();
        } else {
          await page.goto('/ai-agents/new');
          await expect(
            page.getByTestId(view === 'form' ? 'agent-create-form' : 'agent-create-blocked'),
          ).toBeVisible();
          if (view === 'form') await page.getByTestId('agent-name').fill('AI-продавец Luxx 2');
        }
        const scan = await new AxeBuilder({ page }).analyze();
        expect(scan.violations.map((v) => v.id)).toEqual([]);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
        mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({
          path: `${SHOTS}/create-${view}-${theme}-${width}.png`,
          fullPage: true,
        });
      });
    }
  }
}

test('диктовка: расшифровку можно исправить, переход к инструкции выключает микрофон', async ({
  page,
  request,
}) => {
  await control(request, FREE);
  await page.addInitScript(`window.SpeechRecognition = class {
    start() { this.onresult({resultIndex:0,results:[{isFinal:true,0:{transcript:'Голосовой рассказ тестового владельца.'}}]}); }
    stop() { window.__dictationStopped = true; this.onend?.(); }
    abort() { window.__dictationStopped = true; }
  };`);
  await signIn(page);
  await page.goto('/ai-agents/new');
  await page.getByTestId('agent-name').fill('Голосовой тест');
  await page.getByTestId('agent-create-submit').click();
  await page.waitForURL(/\/ai-agents\/[0-9a-f-]{36}$/);
  await page.getByRole('button', { name: 'Надиктовать', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Ваш рассказ', exact: true })).toHaveValue(
    'Голосовой рассказ тестового владельца.',
  );
  await page.getByRole('button', { name: /03 Инструкция/ }).click();
  expect(await page.evaluate('window.__dictationStopped')).toBe(true);
  await page.getByRole('button', { name: /Ваш рассказ/ }).click();
  await page
    .getByRole('textbox', { name: 'Ваш рассказ', exact: true })
    .fill('Исправленная расшифровка');
  await expect(page.getByRole('textbox', { name: 'Ваш рассказ', exact: true })).toHaveValue(
    'Исправленная расшифровка',
  );
});
