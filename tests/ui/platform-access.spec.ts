import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Роли, главный администратор и расширение «ИИ-продавец» на стойке (DATA_MODEL §16, ADR-083, Q-183). Стенд
 * (`scripts/preview/fixture-api.ts`) отвечает так же, как API: роль и отметка — в `/auth/me`, отказ раздела продавца —
 * 403 теми же словами. Проверяется, что стойка показывает человеку ровно то, что ему открыто.
 */
const API = 'http://127.0.0.1:4311';

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
  body: Record<string, unknown>,
) => request.post(`${API}/__test/control`, { data: body });

/** Снимки для отчёта владельцу: как выглядит каждое состояние (reports/platform-access-2026-09-25/) */
const shot = (page: Page, name: string) =>
  page.screenshot({ path: `reports/platform-access-2026-09-25/${name}.png`, fullPage: true });

const menuLinks = (page: Page) =>
  page
    .locator('.workspace-header .topmenu a')
    .evaluateAll((items) => items.map((item) => item.getAttribute('href')));

test('меню: «ИИ-агенты» — всегда (ADR-090), «Платформа» — у главного администратора', async ({
  page,
  request,
}) => {
  // без входа стойка не знает организацию: продавец виден для знакомства (ADR-090), «Платформы» нет
  await page.goto('/today');
  await expect.poll(() => menuLinks(page)).toContain('/ai-agents');
  expect(await menuLinks(page)).not.toContain('/platform');

  await signIn(page);
  await expect.poll(() => menuLinks(page)).toContain('/ai-agents');
  expect(await menuLinks(page)).not.toContain('/platform');
  // вместо «Администратор» — кто вошёл и его роль: подпись кнопки профиля в шапке (ADR-134)
  const footer = page.locator('.workspace-header .profile-caption');
  await expect(footer).toContainText('Дана Тестова');
  await expect(footer).toContainText('Владелец');

  await control(request, { sellerExtension: 'off', platformAdmin: true });
  await page.goto('/today');
  await expect.poll(() => menuLinks(page)).toContain('/platform');
  // расширение выключено, а пункт остаётся (ADR-090): закрытый доступ объясняет сам раздел
  expect(await menuLinks(page)).toContain('/ai-agents');
  await expect(page.locator('.workspace-header .topmenu__tab')).toHaveText([
    'Главная',
    'Календарь',
    'Брони',
    'Гости',
    'Финансы',
    'Продажи',
    'Отчёты',
    'Номерной фонд',
    'Настройки',
    'Платформа',
  ]);
  await expect(footer).toContainText('Владелец · главный администратор');
  await page
    .locator('.workspace-header')
    .getByRole('button', { name: 'Платформа', exact: true })
    .click();
  await shot(page, 'menu-platform-admin');
});

test('расширение не подключено: раздел объясняет, что это и кто подключает; в профиле — то же', async ({
  page,
  request,
}) => {
  await signIn(page);
  await control(request, { sellerExtension: 'off' });
  await page.goto('/ai-seller');
  const main = page.getByRole('main');
  const off = main.getByTestId('seller-extension-off');
  await expect(off).toContainText('Расширение «ИИ-продавец» не подключено');
  await expect(off).toContainText('Подключает администратор WETOP после оплаты');
  // экранов раздела нет: ни окна инструкции, ни проверки
  await expect(main.getByTestId('seller-setup')).toHaveCount(0);
  await shot(page, 'seller-extension-off');

  await page.goto('/profile');
  await page.getByRole('tab', { name: 'Расширения' }).click();
  const card = page.getByTestId('profile-seller');
  await expect(card).toContainText('не подключён');
  await expect(card).toContainText('Подключает администратор WETOP после оплаты по счёту');
});

test('срок вышел: всё видно, но менять, отвечать гостю и проверять нельзя', async ({
  page,
  request,
}) => {
  await signIn(page);
  await control(request, { sellerExtension: 'expired' });
  await page.goto('/ai-seller');
  const main = page.getByRole('main');
  await expect(main.getByTestId('seller-state')).toContainText('срок вышел');
  const setup = main.getByTestId('seller-setup');
  await expect(setup.getByTestId('seller-read-only')).toContainText('Срок расширения вышел');
  // окно инструкции — на шаге «Инструкция» степпера; клик до гидрации теряется — повторяем
  await expect(async () => {
    await main.getByRole('button', { name: 'Инструкция' }).click();
    await expect(setup.getByRole('textbox', { name: 'Инструкция продавцу' })).toBeVisible({
      timeout: 1_000,
    });
  }).toPass({ timeout: 15_000 });
  await expect(setup.getByRole('textbox', { name: 'Инструкция продавцу' })).toBeDisabled();
  await expect(main.getByTestId('seller-prompt-save')).toHaveCount(0);
  // список «До запуска» — тому, кто может его выполнить: после срока его нет
  await expect(main.getByTestId('seller-checklist')).toHaveCount(0);
  await expect(main.getByTestId('seller-check').getByTestId('seller-action-closed')).toContainText(
    'Проверка — при действующем расширении',
  );
  await shot(page, 'seller-expired-read-only');

  await page.goto('/ai-seller/dialogs?id=3f2a1b0c-9d8e-4f7a-8b6c-5d4e3f2a1b0c');
  const card = main.getByTestId('seller-dialog-card');
  await expect(card).toContainText('Алия Тестова');
  await expect(card.getByTestId('seller-dialog-read-only')).toBeVisible();
  await expect(card.getByTestId('dialog-reply')).toHaveCount(0);
  await expect(card.getByTestId('dialog-takeover')).toHaveCount(0);

  await page.goto('/ai-seller/connections');
  await expect(main.getByTestId('seller-action-closed')).toContainText('Код для сайта');
  await expect(main.getByTestId('seller-embed-snippet')).toHaveCount(0);
});

test('администратор: вместо настроек продавца — его диалоги; приглашают владелец и управляющий (ADR-107)', async ({
  page,
  request,
}) => {
  await signIn(page);
  await control(request, { role: 'STAFF' });
  await page.goto('/ai-seller');
  // настройка, знания и подключения — владельцу и управляющему: раздел открывается сразу на диалогах
  await page.waitForURL('**/ai-seller/dialogs');
  const main = page.getByRole('main');
  await expect(main.getByTestId('seller-setup')).toHaveCount(0);
  await shot(page, 'seller-staff-dialogs');

  await page.goto('/ai-seller/dialogs?id=3f2a1b0c-9d8e-4f7a-8b6c-5d4e3f2a1b0c');
  await expect(
    main.getByTestId('seller-dialog-card').getByTestId('seller-dialog-read-only'),
  ).toHaveCount(0);
  await expect(main.getByTestId('seller-dialog-card').getByTestId('dialog-reply')).toBeVisible();
  await expect(main.getByTestId('seller-dialog-card').getByTestId('dialog-takeover')).toBeVisible();

  await expect(page.locator('.workspace-header .profile-caption')).toContainText('Администратор');
  // панель вошедшего с приглашениями живёт на /profile/access: /auth/fallback — резервная форма без сессии
  await page.goto('/profile/access');
  await expect(page.getByTestId('invite-not-allowed')).toHaveText(
    'Приглашать сотрудников могут владелец и управляющий.',
  );
});

test('управляющий настраивает продавца наравне с владельцем (ADR-107)', async ({
  page,
  request,
}) => {
  await signIn(page);
  await control(request, { role: 'MANAGER' });
  await page.goto('/ai-seller');
  const main = page.getByRole('main');
  // окно инструкции — на шаге «Инструкция» степпера; клик до гидрации теряется — повторяем
  await expect(async () => {
    await main.getByRole('button', { name: 'Инструкция' }).click();
    await expect(main.getByRole('textbox', { name: 'Инструкция продавцу' })).toBeVisible({
      timeout: 1_000,
    });
  }).toPass({ timeout: 15_000 });
  await expect(main.getByRole('textbox', { name: 'Инструкция продавцу' })).toBeEnabled();
  await expect(main.getByTestId('seller-read-only')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Все агенты' })).toBeVisible();
});

test('за неделю до конца срока владелец видит напоминание; управляющий и администратор — нет', async ({
  page,
  request,
}) => {
  await signIn(page);
  await control(request, { sellerDaysLeft: 3 });
  await page.goto('/ai-seller/knowledge');
  const reminder = page.getByRole('main').getByTestId('seller-extension-ending');
  await expect(reminder).toContainText('Расширение «ИИ-продавец» действует ещё 3 дня');
  await expect(reminder).toContainText('Продлевает администратор WETOP после оплаты');
  await shot(page, 'seller-reminder');

  // платные расширения — владельческое (ADR-107): управляющий настраивает, но о продлении не напоминаем
  await control(request, { sellerDaysLeft: 3, role: 'MANAGER' });
  await page.goto('/ai-seller/knowledge');
  await expect(page.getByRole('main').getByTestId('seller-facts')).toBeVisible();
  await expect(page.getByRole('main').getByTestId('seller-extension-ending')).toHaveCount(0);

  await control(request, { sellerDaysLeft: 3, role: 'STAFF' });
  await page.goto('/ai-seller/dialogs');
  await expect(page.getByRole('main').getByTestId('seller-extension-ending')).toHaveCount(0);
});

test('«Платформа → Организации»: главный администратор включает и выключает продавца организации', async ({
  page,
  request,
}) => {
  await signIn(page);
  // без отметки — раздел так и говорит, чей он
  await page.goto('/platform');
  await expect(page.getByTestId('platform-forbidden')).toContainText('главного администратора');

  await control(request, { platformAdmin: true });
  await page.goto('/platform');
  await page.locator('summary').filter({ hasText: 'Подписки и администрирование' }).click();
  const table = page.getByTestId('platform-organizations');
  await expect(table).toContainText('Luxx Aparts');
  await expect(table).toContainText('Хостел «Пример»');
  await expect(table).toContainText('owner@example.com');
  const other = table.getByRole('row', { name: /Хостел «Пример»/ });
  await expect(other).toContainText('не подключён');

  await other.getByRole('link', { name: 'Хостел «Пример»' }).click();
  const form = page.getByTestId('platform-extension-form');
  await form.getByLabel('Статус').selectOption('TRIAL');
  await form.getByLabel('Действует по (включительно)').fill('');
  await form.getByRole('button', { name: 'Сохранить' }).click();
  // пробному нужен срок — слова API
  await expect(page.getByTestId('platform-extension-error')).toHaveText(
    'У пробного доступа нужен срок',
  );

  await form.getByLabel('Статус').selectOption('ACTIVE');
  await form.getByLabel('Заметка — номер счёта').fill('Счёт № 17');
  await form.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByTestId('platform-extension-result')).toContainText(
    'ИИ-продавец действует',
  );
  await expect(table.getByRole('row', { name: /Хостел «Пример»/ })).toContainText(
    'оплачен, бессрочно',
  );
  await shot(page, 'platform-organizations');

  // своя гостиница: выключить — пункт меню остаётся (ADR-090), а раздел закрыт и говорит почему
  await page.goto('/platform?org=ui-org');
  await page.getByTestId('platform-extension-form').getByLabel('Статус').selectOption('OFF');
  await page
    .getByTestId('platform-extension-form')
    .getByRole('button', { name: 'Сохранить' })
    .click();
  await expect(page.getByTestId('platform-extension-result')).toContainText('не подключён');
  await page.goto('/ai-seller');
  const main = page.getByRole('main');
  await expect(main.getByTestId('seller-extension-off')).toContainText(
    'Расширение «ИИ-продавец» не подключено',
  );
  await expect(main.getByTestId('seller-setup')).toHaveCount(0);
});

for (const width of [1440, 390]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`доступность: «Организации» и состояния расширения, ${theme}, ${width}px`, async ({
      page,
      request,
    }) => {
      test.setTimeout(180_000);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height: 1000 });
      await signIn(page);
      const screens: Array<{ control: Record<string, unknown>; route: string }> = [
        { control: { platformAdmin: true }, route: '/platform?org=ui-org-2' },
        { control: { sellerExtension: 'off' }, route: '/ai-seller' },
        { control: { sellerExtension: 'expired' }, route: '/ai-seller' },
        { control: { sellerExtension: 'expired' }, route: '/ai-seller/connections' },
        { control: { sellerDaysLeft: 3, role: 'STAFF' }, route: '/ai-seller' },
        { control: { sellerDaysLeft: 1 }, route: '/profile' },
      ];
      for (const { control: body, route } of screens) {
        await control(request, body);
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
