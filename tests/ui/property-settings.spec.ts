import { FIXTURE_API, expect, test, devNoise, type Page } from './fixtures';
import type { APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

/**
 * «Настройки объекта» v2, срез SET1 (`plans/property-settings-set1-2026-09-27.md`, ADR-115): один заголовок на три
 * вкладки, без «Обновить» и без дубля часов заезда; «Основное» — три блока, сохранение в шапке с состоянием;
 * правила отмены ушли к тарифам. Схема и API не менялись — стенд тот же подставной API.
 */
const API = FIXTURE_API;
const SHOTS = 'reports/unified-sections-2026-10-01/property-settings-set1-2026-09-27';
const control = (request: APIRequestContext, body: Record<string, unknown>) =>
  request.post(`${API}/__test/control`, { data: body });

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

test('один заголовок на трёх вкладках, без «Обновить» и без второй карточки часов', async ({
  page,
}) => {
  const main = page.getByRole('main');
  await page.goto('/hotel-settings');
  const tabs = main.getByRole('navigation', { name: 'Настройки объекта', exact: true });
  await expect(tabs.getByRole('link')).toHaveText([
    'Основное',
    'Проживание',
    'Услуги',
    'Продажи и каналы',
    'Документы',
  ]);
  for (const [tab, check] of [
    ['Основное', 'stored-property'],
    ['Проживание', 'stay-settings'],
    ['Услуги', 'services-table'],
    ['Продажи и каналы', 'sales-summary'],
    ['Документы', 'documents-summary'],
  ] as const) {
    await tabs.getByRole('link', { name: tab, exact: true }).click();
    await expect(tabs.getByRole('link', { name: tab, exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(main.getByTestId(check)).toBeVisible();
    await expect(main.getByRole('heading', { level: 1 })).toHaveText('Настройки объекта');
    await expect(main.locator('.page__subtitle')).toContainText('Здесь вы настраиваете данные филиала');
    await expect(main.getByRole('button', { name: 'Обновить' })).toHaveCount(0);
    await expect(main.locator('.page__crumbs')).toContainText('Настройки объекта');
  }
  await expect(page.locator('.workspace-header .topmenu [aria-current="page"]')).toHaveText(
    'Объект',
  );

  await tabs.getByRole('link', { name: 'Основное', exact: true }).click();
  const general = main.getByTestId('stored-property');
  for (const section of ['Основная информация', 'Расположение и классификация', 'Юридические данные'])
    await expect(general.getByRole('heading', { name: section, level: 2 })).toBeVisible();
  // «Основное» по верстке владельца (ADR-158) содержит и заезд с правилами; «Проживание» показывает их отдельно
  await expect(main.getByTestId('stay-settings')).toBeVisible();
  await expect(tabs.getByRole('link', { name: 'Правила отмены' })).toHaveCount(0);
});

test('старые адреса: часы — на «Проживание», правила отмены — к тарифам без кода Legacy', async ({
  page,
}) => {
  const main = page.getByRole('main');
  await page.goto('/hotel-settings/check-in');
  await expect(page).toHaveURL(/\/hotel-settings\/stay$/);
  await expect(main.getByTestId('stay-settings').getByLabel('Заезд с')).toHaveValue('14:00');
  await page.goto('/hotel-settings/description');
  await expect(page).toHaveURL(/\/hotel-settings$/);
  await expect(main.getByTestId('stored-property')).toBeVisible();
  await page.goto('/hotel-settings/penalties');
  // «Тарифы и цены» сняты 06.10.2026: старый адрес правил отмены ведёт в настройки объекта
  await expect(page).toHaveURL(/\/hotel-settings$/, { timeout: 40_000 });
});

test('владелец: «Сохранить изменения» ждёт правки, показывает «есть изменения», «сохранено» и ошибку', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/hotel-settings');
  const main = page.getByRole('main');
  const save = main.locator('.page__actions').getByRole('button', { name: 'Сохранить изменения' });
  const state = main.getByTestId('settings-save-state');
  const form = main.getByTestId('hotel-settings-form');
  await expect(save).toBeDisabled();
  await expect(state).toHaveText('');
  await expect(form.getByLabel('Название объекта')).toHaveValue('Luxx Aparts');
  // валюта и пояс только для чтения: меняет поддержка (ADR-158: поля стоят, но правки не принимают)
  await expect(form.getByLabel('Валюта')).toHaveAttribute('readonly', '');

  await form.getByLabel('Телефон').fill('+7 701 555 44 33');
  await expect(state).toHaveText('• Есть несохранённые изменения');
  await expect(save).toBeEnabled();
  await form.getByLabel('Телефон').fill('+7 700 000 00 00');
  await expect(save).toBeDisabled();
  await form.getByLabel('Телефон').fill('+7 701 555 44 33');
  await form.getByLabel('Юридическое лицо').fill('ИП «Тестовый»');
  await form.getByLabel('Страна (ISO)').selectOption('KZ');
  await form.getByLabel('Город', { exact: true }).fill('Вымышленный город');
  await form.getByLabel('Тип размещения').selectOption('motel');
  await save.click();
  await expect(state).toHaveText('✓ Изменения сохранены');
  await expect(save).toBeDisabled();
  await expect(main.getByRole('alert')).toHaveCount(0);
  await page.reload();
  await expect(form.getByLabel('Телефон')).toHaveValue('+7 701 555 44 33');
  await expect(form.getByLabel('Юридическое лицо')).toHaveValue('ИП «Тестовый»');
  await expect(form.getByLabel('Страна (ISO)')).toHaveValue('KZ');
  await expect(form.getByLabel('Город', { exact: true })).toHaveValue('Вымышленный город');
  await expect(form.getByLabel('Тип размещения')).toHaveValue('motel');

  await form.getByLabel('Почта').fill('не почта');
  await save.click();
  await expect(main.getByRole('alert')).toContainText('Почта в виде name@example.kz');
  await expect(form.getByLabel('Почта')).toHaveValue('не почта');
  await expect(state).toHaveText('• Есть несохранённые изменения');

  // «Проживание» шлёт только свои поля: сведения «Основного» не затираются
  await main
    .getByRole('navigation', { name: 'Настройки объекта' })
    .getByRole('link', { name: 'Проживание' })
    .click();
  const stay = main.getByTestId('stay-settings');
  await expect(save).toBeDisabled();
  await stay.getByLabel('Заезд с').fill('15:00');
  await save.click();
  await expect(state).toHaveText('✓ Изменения сохранены');
  await page.reload();
  await expect(stay.getByLabel('Заезд с')).toHaveValue('15:00');
  await expect(stay.getByLabel('Выезд до')).toHaveValue('12:00');
  await page.goto('/hotel-settings');
  await expect(form.getByLabel('Телефон')).toHaveValue('+7 701 555 44 33');
  await expect(form.getByLabel('Почта')).toHaveValue('hostel@example.invalid');
});

test('администратор и «только чтение» видят сведения без формы и без кнопки сохранения', async ({
  page,
  request,
}) => {
  const main = page.getByRole('main');
  await signIn(page);
  // Роли (ADR-107): администратору (STAFF) раздел закрыт целиком — «Нет доступа», сведений и формы нет
  await control(request, { role: 'STAFF' });
  await page.goto('/hotel-settings');
  await expect(main.getByTestId('no-access')).toBeVisible();
  await expect(main.getByTestId('stored-property')).toHaveCount(0);
  await expect(main.getByTestId('hotel-settings-form')).toHaveCount(0);
  await expect(main.getByRole('button', { name: 'Сохранить изменения' })).toHaveCount(0);

  await control(request, { role: 'OWNER', orgTrialDays: 'ended' });
  for (const path of ['/hotel-settings', '/hotel-settings/stay']) {
    await page.goto(path);
    await expect(page.getByTestId('read-only-banner')).toBeVisible();
    await expect(main.getByRole('button', { name: 'Сохранить изменения' })).toHaveCount(0);
    // поля стоят, но выключены или только для чтения: править нечем
    await expect(main.locator('input:enabled:not([readonly]):not([type=hidden])')).toHaveCount(0);
  }
  await expect(main.getByTestId('stay-settings').getByLabel('Выезд до')).toHaveValue('12:00');
});

test('данные объекта и каналов помещаются на экране ноутбука', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/hotel-settings');
  const form = page.getByTestId('hotel-settings-form');
  // три колонки по верстке владельца (ADR-158): тип размещения в первом экране, юридические данные ниже
  for (const [label, bottom] of [
    ['Тип размещения', 876],
    ['ИИН/БИН', 1100],
  ] as const) {
    const box = await form.getByLabel(label).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(bottom);
  }
});

for (const theme of ['light', 'dark'] as const) {
  test(`снимки SET1 и доступность: ${theme}`, async ({ page, request }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      if (!devNoise.test(error.message)) errors.push(error.message);
    });
    await signIn(page);
    mkdirSync(SHOTS, { recursive: true });
    const main = page.getByRole('main');
    const shot = async (name: string) => {
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        await page.screenshot({ path: `${SHOTS}/${name}-${theme}-${width}.png`, fullPage: true });
      }
      await page.setViewportSize({ width: 1440, height: 900 });
    };
    for (const [route, name] of [
      ['/hotel-settings', 'general'],
      ['/hotel-settings/stay', 'stay'],
      ['/hotel-settings/services', 'services'],
    ] as const) {
      await page.goto(route);
      await expect(main.getByRole('heading', { level: 1 })).toHaveText('Настройки объекта');
      await expect(main.locator('[data-testid$="loading"]')).toHaveCount(0);
      const audit = await new AxeBuilder({ page })
        .include('main')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(audit.violations).toEqual([]);
      await shot(name);
    }
    await page.goto('/hotel-settings');
    const form = main.getByTestId('hotel-settings-form');
    const save = main.getByRole('button', { name: 'Сохранить изменения' });
    await form.getByLabel('Телефон').fill('+7 701 555 44 33');
    await expect(save).toBeEnabled();
    await shot('general-changed');
    await form.getByLabel('Почта').fill('не почта');
    await save.click();
    await expect(main.getByRole('alert')).toBeVisible();
    await shot('general-error');
    await form.getByLabel('Почта').fill('hostel@example.invalid');
    await save.click();
    await expect(main.getByTestId('settings-save-state')).toHaveText('✓ Изменения сохранены');
    await shot('general-saved');
    await control(request, { orgTrialDays: 'ended' });
    await page.goto('/hotel-settings');
    await expect(page.getByTestId('read-only-banner')).toBeVisible();
    await shot('general-read-only');
    expect(errors).toEqual([]);
  });
}
