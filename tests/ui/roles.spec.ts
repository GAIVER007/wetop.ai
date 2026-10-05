import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API, expect, test } from './fixtures';
import type { APIRequestContext, Page } from '@playwright/test';

/**
 * Роли на стойке (ADR-107, DATA_MODEL §16.5): владелец — всё; управляющий — всё, кроме владельческого; администратор —
 * работа с гостями, «Оплаты» и «Статистика» на просмотр, диалоги продавца и неисправности. Стенд
 * (`scripts/preview/fixture-api.ts`) отдаёт роль в `/auth/me`, сотрудников и приглашения — как API. Проверяется, что
 * стойка показывает человеку ровно его разделы и кнопки; права в API закрыты тестами контроллеров и замка ролей.
 */
const API = FIXTURE_API;

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

const asRole = (request: APIRequestContext, role: 'OWNER' | 'MANAGER' | 'STAFF') =>
  request.post(`${API}/__test/control`, { data: { role } });

const menuLinks = (page: Page) =>
  page
    .locator('.workspace-header .topmenu a')
    .evaluateAll((items) => items.map((item) => item.getAttribute('href')));

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `reports/roles-2026-09-27/${name}.png`, fullPage: true });

test('администратор: в меню — работа с гостями, оплаты, статистика, продавец и неисправности', async ({
  page,
  request,
}) => {
  await signIn(page);
  await asRole(request, 'STAFF');
  await page.goto('/today');
  await expect
    .poll(() => menuLinks(page))
    .toEqual([
      '/today',
      '/chessboard',
      '/reservations',
      '/guests',
      '/finance',
      '/bar',
      '/market',
      '/ai-agents',
      '/reports',
      '/management/analytics',
      '/incidents',
    ]);
  await expect(page.locator('.workspace-header .profile-caption')).toContainText('Администратор');
  // объект в шапке в настройки гостиницы не ведёт
  await expect(page.locator('.workspace-header a.workspace-property')).toHaveCount(0);
  await shot(page, 'menu-administrator');
});

test('администратор: закрытые разделы по адресу говорят, у кого доступ, — и данных не показывают', async ({
  page,
  request,
}) => {
  await signIn(page);
  await asRole(request, 'STAFF');
  const main = page.getByRole('main');
  for (const [route, title, text] of [
    ['/rates', 'Тарифы', '«Тарифы и цены»: доступ есть у владельца и управляющего.'],
    ['/journal', 'Журнал', '«Журнал действий»: доступ есть у владельца и управляющего.'],
    ['/channels', 'Каналы продаж', '«Каналы продаж»: доступ есть у владельца и управляющего.'],
    [
      '/hotel-settings',
      'Настройки объекта',
      '«Настройки гостиницы»: доступ есть у владельца и управляющего.',
    ],
    [
      '/ai-seller/knowledge',
      'Знания ИИ-продавца',
      '«Настройки ИИ-продавца»: доступ есть у владельца и управляющего.',
    ],
  ] as const) {
    await page.goto(route);
    const refusal = page.getByTestId('no-access').filter({ visible: true });
    await expect(refusal).toContainText(text);
    await expect(refusal).toContainText('Ваша роль — администратор');
    // заголовок — раздела, а не самой страницы: её содержимого на экране нет
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    if (route === '/rates') await shot(page, 'no-access-administrator');
  }

  // из карточки брони в журнал администратору не ведёт
  await page.goto('/reservations/20260913-TESTAA');
  await page.getByRole('tab', { name: 'История', exact: true }).click();
  await expect(main.getByTestId('journal-closed')).toBeVisible();
  await expect(main.getByRole('link', { name: 'Открыть журнал' })).toHaveCount(0);
});

test('администратор: в «ИИ-продавце» только диалоги, раздел открывается сразу на них', async ({
  page,
  request,
}) => {
  await signIn(page);
  await asRole(request, 'STAFF');
  await page.goto('/ai-seller');
  await page.waitForURL('**/ai-seller/dialogs');
  const tabs = page.getByRole('navigation', { name: 'ИИ-продавец' });
  await expect(tabs.getByRole('link')).toHaveText(['Диалоги']);
  await expect(page.getByRole('link', { name: 'Все агенты' })).toHaveCount(0);
  await page.goto('/ai-seller/dialogs?id=3f2a1b0c-9d8e-4f7a-8b6c-5d4e3f2a1b0c');
  const card = page.getByRole('main').getByTestId('seller-dialog-card');
  await expect(card.getByTestId('dialog-reply')).toBeVisible();
  await expect(card.getByTestId('dialog-takeover')).toBeVisible();
});

test('администратор принимает оплату, но возврата и сторно у него нет; у управляющего — есть', async ({
  page,
  request,
}) => {
  await signIn(page);
  const pay = async (note: string) => {
    await page.goto('/reservations/20260913-TESTAA');
    await page.getByRole('tab', { name: 'Счета', exact: true }).click();
    const form = page.getByTestId('payment-form').first();
    await form.locator('[name=amount]').fill('1000');
    await form.locator('[name=note]').fill(note);
    await form.getByRole('button', { name: 'Принять оплату' }).click();
    await expect(page.getByTestId('payment-row').filter({ hasText: note })).toHaveCount(1);
  };

  const main = page.getByRole('main');
  // «сторно» прячет тот же признак, что и возврат; ручных начислений у стенда нет — отказ API проверен в
  // finance.controller.test.ts («роли в деньгах»)
  await asRole(request, 'STAFF');
  await pay('оплата администратора');
  await expect(main.getByTestId('refund-form')).toHaveCount(0);
  await expect(main.getByRole('columnheader', { name: 'Возврат', exact: true })).toHaveCount(0);

  await asRole(request, 'MANAGER');
  await pay('оплата управляющего');
  await expect(main.getByTestId('refund-form').first()).toBeVisible();
});

test('администратор меняет даты и продлевает в тарифе брони; брони без тарифа назначает тариф со штрафом (Q-200, Q-201)', async ({
  page,
  request,
}) => {
  await signIn(page);
  const actions = async () => {
    await page.goto('/reservations/20260913-TESTAA');
    await page.getByRole('tab', { name: 'Действия', exact: true }).click();
  };
  const main = page.getByRole('main');

  await asRole(request, 'STAFF');
  await actions();
  await expect(main.getByRole('button', { name: 'Пересчитать и сохранить' })).toBeVisible();
  await expect(main.getByLabel('Тариф для пересчёта')).toHaveCount(0);
  await expect(main.getByText('Тариф при смене категории')).toHaveCount(0);

  // бронь из Legacy без тарифа: администратор назначает её тариф, но только со штрафом за отмену (Q-201) —
  // «Гибкий без штрафа» в списках нет
  await request.post(`${API}/__test/control`, {
    data: { role: 'STAFF', withoutRatePlan: true, softPlan: true },
  });
  await actions();
  await expect(main.getByTestId('dates-no-plan')).toContainText(
    'выберите тариф со штрафом за отмену',
  );
  await expect(main.getByLabel('Тариф для пересчёта').locator('option')).toHaveText([
    '— выберите тариф —',
    'Стандартный',
  ]);
  await expect(main.getByRole('button', { name: 'Пересчитать и сохранить' })).toBeVisible();
  await expect(main.getByText('Тариф при смене категории')).toBeVisible();
  const extendPlan = main.getByLabel('Тариф для продления');
  await expect(extendPlan.locator('option')).toHaveText([
    '— тариф для новой ночи —',
    'Стандартный',
  ]);
  await expect(main.getByTestId('extend-ui-item')).toBeDisabled();
  await extendPlan.selectOption('BASE');
  await expect(main.getByTestId('hint-extend-ui-item')).toContainText('на счёт');
  await main.getByTestId('extend-ui-item').click();
  await page
    .locator('dialog[open][data-testid="confirm-dialog"]')
    .getByRole('button', { name: 'Продлить' })
    .click();
  await expect(main.getByTestId('done-extend-ui-item')).toBeVisible();
  // тариф записан в бронь: выбирать администратору больше нечего, дальше его меняют владелец и управляющий
  await expect(main.getByLabel('Тариф для продления')).toHaveCount(0);
  await expect(main.getByLabel('Тариф для пересчёта')).toHaveCount(0);
  await expect(main.getByTestId('dates-no-plan')).toHaveCount(0);

  // у управляющего выбор любого тарифа, и без штрафа тоже
  await request.post(`${API}/__test/control`, { data: { role: 'MANAGER', withoutRatePlan: true } });
  await actions();
  await expect(main.getByLabel('Тариф для пересчёта').locator('option')).toHaveText([
    '— выберите тариф —',
    'Стандартный',
    'Гибкий без штрафа',
  ]);
  await expect(main.getByLabel('Тариф для продления')).toBeVisible();
});

test('управляющий: всё, кроме «Платформы»; зовёт только администраторов и отключает только их', async ({
  page,
  request,
}) => {
  await signIn(page);
  await asRole(request, 'MANAGER');
  await page.goto('/today');
  await expect.poll(() => menuLinks(page)).toContain('/rates');
  const links = await menuLinks(page);
  for (const href of ['/journal', '/channels', '/hotel-settings', '/team', '/connections'])
    expect(links).toContain(href);
  expect(links).not.toContain('/platform');
  await expect(page.locator('.workspace-header .profile-caption')).toContainText('Управляющий');

  await page.goto('/rates');
  await expect(page.getByRole('main').getByTestId('no-access')).toHaveCount(0);

  // команда — на странице «Сотрудники» (TEAM1); приглашение — панелью из шапки
  await page.goto('/team');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Пригласить сотрудника' }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByTestId('invite-role-fixed')).toContainText(
    'Управляющий приглашает администраторов',
  );
  await expect(drawer.getByLabel('Роль приглашённого', { exact: true })).toHaveCount(0);
  await drawer.getByRole('button', { name: 'Отмена' }).click();
  const rows = main.getByTestId('member-row');
  await expect(rows).toHaveCount(3);
  await expect(
    rows.filter({ hasText: 'Марат Тестов' }).getByRole('button', { name: 'Отключить' }),
  ).toHaveCount(0);
  await expect(rows.filter({ hasText: 'Дана Тестова' })).toContainText('это вы');
  // роль меняет только владелец
  await expect(main.getByRole('combobox', { name: /^Роль:/ })).toHaveCount(0);
  // приглашение управляющего отозвать нельзя, администратора — можно
  const invites = main.getByTestId('invite-list');
  await expect(
    invites.locator('li', { hasText: 'boss@example.com' }).getByRole('button'),
  ).toHaveCount(0);
  await invites
    .locator('li', { hasText: 'zhdet@example.com' })
    .getByRole('button', { name: 'Отозвать' })
    .click();
  await expect(invites).not.toContainText('zhdet@example.com');

  await rows.filter({ hasText: 'Юрий Тестов' }).getByRole('button', { name: 'Отключить' }).click();
  await page
    .locator('dialog[open][data-testid="confirm-dialog"]')
    .getByRole('button', { name: 'Отключить' })
    .click();
  await expect(rows).toHaveCount(2);
  await expect(main).not.toContainText('Юрий Тестов');
});

test('владелец: зовёт управляющего и администратора, меняет роль', async ({ page }) => {
  await signIn(page);
  await page.goto('/team');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Пригласить сотрудника' }).click();
  const drawer = page.getByRole('dialog');
  const role = drawer.getByLabel('Роль приглашённого', { exact: true });
  await expect(role.locator('option')).toHaveText(['Управляющий', 'Администратор']);
  await expect(role).toHaveValue('STAFF');

  await drawer.getByLabel('Почта приглашённого').fill('New.Manager@Example.com');
  await role.selectOption('MANAGER');
  await drawer.getByRole('button', { name: 'Отправить приглашение' }).click();
  // панель закрылась, приглашение — в «Ожидают ответа» с ролью словом
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const invites = main.getByTestId('invite-list');
  await expect(invites.locator('li', { hasText: 'new.manager@example.com' })).toContainText(
    'управляющий',
  );
  await expect(invites.locator('li', { hasText: 'boss@example.com' })).toContainText('управляющий');
  await expect(invites.locator('li', { hasText: 'zhdet@example.com' })).toContainText(
    'администратор',
  );

  const admin = main.getByTestId('member-row').filter({ hasText: 'Юрий Тестов' });
  await expect(admin).toContainText('администратор');
  await admin.getByRole('combobox', { name: 'Роль: Юрий Тестов' }).selectOption('MANAGER');
  await expect(admin).toContainText('управляющий');
  await shot(page, 'team-owner');
});

test('администратор: сотрудниками ведают владелец и управляющий', async ({ page, request }) => {
  await signIn(page);
  await asRole(request, 'STAFF');
  await page.goto('/profile/access');
  await expect(page.getByTestId('invite-not-allowed')).toHaveText(
    'Приглашать сотрудников могут владелец и управляющий.',
  );
  await expect(page.getByTestId('team')).toHaveCount(0);
});

for (const width of [1440, 390]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`доступность: сотрудники и отказ по роли, ${theme}, ${width}px`, async ({
      page,
      request,
    }) => {
      test.setTimeout(120_000);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height: 1000 });
      await signIn(page);
      for (const [role, route] of [
        ['OWNER', '/profile/access'],
        ['MANAGER', '/profile/access'],
        ['STAFF', '/rates'],
      ] as const) {
        await asRole(request, role);
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
            `${role} ${route}`,
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
