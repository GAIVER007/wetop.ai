import { expect, test, devNoise, type Page } from './fixtures';
import type { APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

/**
 * «Настройки объекта» v2, SET2 и SET3 (`plans/property-settings-set2-set3-2026-09-28.md`, дополнение к ADR-115): время
 * заезда и выезда — всегда 24 часа, ошибка у поля; каталог услуг — отбор по группе и статусу, новая услуга и правка
 * панелью, архив вместо удаления, код услуги не виден. Стенд — подставной API с тем же разбором, что у API.
 */
const API = 'http://127.0.0.1:4311';
const SHOTS = 'reports/unified-sections-2026-10-01/property-settings-set2-set3-2026-09-28';
const control = (request: APIRequestContext, body: Record<string, unknown>) =>
  request.post(`${API}/__test/control`, { data: body });

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
}

test('«Проживание»: время в 24 часах, ошибка у поля, «9:00» сохраняется как 09:00', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/hotel-settings/stay');
  const main = page.getByRole('main');
  const checkIn = main.getByLabel('Заезд с');
  const save = main.getByRole('button', { name: 'Сохранить изменения' });
  await expect(checkIn).toHaveValue('14:00');
  await expect(checkIn).toHaveAttribute('inputmode', 'numeric');
  await expect(main.getByLabel('Выезд до')).toHaveValue('12:00');

  await checkIn.fill('2 PM');
  await checkIn.blur();
  await expect(checkIn).toHaveAttribute('aria-invalid', 'true');
  await expect(main.getByTestId('stay-settings').getByRole('alert')).toHaveText(
    'Время заезда — в виде 14:00',
  );
  await save.click();
  await expect(main.getByTestId('settings-save-state')).toHaveText(
    '• Есть несохранённые изменения',
  );

  await checkIn.fill('9:00');
  await expect(main.getByTestId('stay-settings').getByRole('alert')).toHaveCount(0);
  await expect(checkIn).not.toHaveAttribute('aria-invalid', 'true');
  await save.click();
  await expect(main.getByTestId('settings-save-state')).toHaveText('✓ Изменения сохранены');
  await page.reload();
  await expect(checkIn).toHaveValue('09:00');
});

test('«Услуги»: активные по умолчанию, отбор по группе и статусу, коды не видны', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/hotel-settings/services');
  const main = page.getByRole('main');
  const table = main.getByTestId('services-table');
  await expect(
    main.locator('.page__actions').getByRole('button', { name: 'Добавить услугу' }),
  ).toBeVisible();
  await expect(table.locator('tbody tr')).toHaveCount(3);
  await expect(main.getByTestId('services-count')).toHaveText('3 услуги');
  await expect(table).not.toContainText('Трансфер (старая цена)');
  for (const code of ['LAUNDRY', 'WATER', 'BAIKAL']) await expect(table).not.toContainText(code);
  await expect(table.locator('strong')).toHaveCount(0);

  await main.getByLabel('Группа').selectOption('Минибар');
  await expect(table.locator('tbody tr')).toHaveCount(2);
  await main.getByLabel('Группа').selectOption('all');
  await main.getByLabel('Статус').selectOption('archived');
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(table.locator('tbody tr').first()).toContainText('Трансфер (старая цена)');
  await expect(table.locator('tbody tr').first()).toContainText('в архиве');
  await main.getByRole('button', { name: 'Сбросить отбор' }).click();
  await expect(table.locator('tbody tr')).toHaveCount(3);
  await main.getByRole('searchbox', { name: 'Найти услугу' }).fill('байкал');
  await expect(table.locator('tbody tr')).toHaveCount(1);
});

test('новая услуга и правка — панелью; архив убирает услугу из выбора в счёте', async ({
  page,
  request,
}) => {
  await signIn(page);
  await page.goto('/hotel-settings/services');
  const main = page.getByRole('main');
  const table = main.getByTestId('services-table');

  await main.getByRole('button', { name: 'Добавить услугу' }).click();
  const drawer = page.getByRole('dialog', { name: 'Новая услуга' });
  await drawer.getByRole('button', { name: 'Создать' }).click();
  await expect(drawer.getByLabel('Название')).toHaveAttribute('aria-invalid', 'true');
  await expect(drawer.getByRole('alert')).toHaveText('Укажите название услуги');
  await drawer.getByLabel('Название').fill('Трансфер из аэропорта');
  await drawer.getByLabel('Группа').fill('Трансфер');
  await drawer.getByLabel('Цена, ₸').fill('0');
  await drawer.getByRole('button', { name: 'Создать' }).click();
  await expect(drawer.getByLabel('Цена, ₸')).toHaveAttribute('aria-invalid', 'true');
  await expect(drawer.getByRole('alert')).toHaveText('Цена — больше нуля, например 700 или 700,50');
  await drawer.getByLabel('Цена, ₸').fill('8 000');
  await drawer.getByRole('button', { name: 'Создать' }).click();
  await expect(drawer).toHaveCount(0);
  await expect(main.getByTestId('service-saved')).toHaveText(
    '✓ Услуга «Трансфер из аэропорта» добавлена',
  );
  await expect(table.getByRole('row', { name: /Трансфер из аэропорта/ })).toContainText('8 000 ₸');

  await table.getByRole('button', { name: 'Вода 0,5' }).click();
  const edit = page.getByRole('dialog', { name: 'Вода 0,5' });
  await expect(edit.getByLabel('Цена, ₸')).toHaveValue('700');
  await edit.getByLabel('Цена, ₸').fill('750');
  await edit.getByRole('button', { name: 'Сохранить' }).click();
  await expect(edit).toHaveCount(0);
  await expect(table.getByRole('row', { name: /Вода 0,5/ })).toContainText('750 ₸');

  await table.getByRole('button', { name: 'Вода 0,5' }).click();
  await page.getByRole('dialog', { name: 'Вода 0,5' }).getByLabel('Статус').selectOption('false');
  await page
    .getByRole('dialog', { name: 'Вода 0,5' })
    .getByRole('button', { name: 'Сохранить' })
    .click();
  await expect(table.getByRole('row', { name: /Вода 0,5/ })).toHaveCount(0);
  await main.getByLabel('Статус').selectOption('archived');
  await expect(table.getByRole('row', { name: /Вода 0,5/ })).toContainText('в архиве');
  // в счёте гостя услугу из архива не выбрать: выбор берёт только активные
  const forCharge = (await (
    await request.get(`${API}/finance/services`, { headers: { 'x-wetop-test-client': '1' } })
  ).json()) as Array<{ code: string }>;
  expect(forCharge.map((s) => s.code)).not.toContain('WATER');
  expect(forCharge[0]?.code).toBe('LAUNDRY');
});

test('«только чтение»: каталог виден, добавить и править нельзя', async ({ page, request }) => {
  await signIn(page);
  await control(request, { orgTrialDays: 'ended' });
  await page.goto('/hotel-settings/services');
  const main = page.getByRole('main');
  await expect(page.getByTestId('read-only-banner')).toBeVisible();
  await expect(main.getByTestId('services-table').locator('tbody tr')).toHaveCount(3);
  await expect(main.getByRole('button', { name: 'Добавить услугу' })).toHaveCount(0);
  await expect(main.getByTestId('services-table').getByRole('button')).toHaveCount(0);
  await page.goto('/hotel-settings/stay');
  await expect(main.locator('input')).toHaveCount(0);
});

for (const theme of ['light', 'dark'] as const) {
  test(`снимки SET2/SET3 и доступность: ${theme}`, async ({ page, request }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      if (!devNoise.test(error.message)) errors.push(error.message);
    });
    await signIn(page);
    mkdirSync(SHOTS, { recursive: true });
    const main = page.getByRole('main');
    const axe = async () => {
      const audit = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(audit.violations).toEqual([]);
    };
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

    await page.goto('/hotel-settings/stay');
    await main.getByLabel('Заезд с').fill('25:00');
    await main.getByLabel('Заезд с').blur();
    await expect(main.getByTestId('stay-settings').getByRole('alert')).toBeVisible();
    await axe();
    await shot('stay-error');

    await page.goto('/hotel-settings/services');
    await expect(main.getByTestId('services-table')).toBeVisible();
    await axe();
    await shot('services');
    await main.getByLabel('Статус').selectOption('archived');
    await shot('services-archived');
    await main.getByLabel('Статус').selectOption('active');

    await main.getByRole('button', { name: 'Добавить услугу' }).click();
    const drawer = page.getByRole('dialog', { name: 'Новая услуга' });
    await drawer.getByRole('button', { name: 'Создать' }).click();
    await expect(drawer.getByRole('alert')).toBeVisible();
    await axe();
    await shot('service-new-error');
    await drawer.getByRole('button', { name: 'Отмена' }).click();

    await main
      .getByTestId('services-table')
      .getByRole('button', { name: 'Байкал в стекле' })
      .click();
    await expect(page.getByRole('dialog', { name: 'Байкал в стекле' })).toBeVisible();
    await axe();
    await shot('service-edit');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await control(request, { orgTrialDays: 'ended' });
    await page.goto('/hotel-settings/services');
    await expect(page.getByTestId('read-only-banner')).toBeVisible();
    await shot('services-read-only');
    expect(errors).toEqual([]);
  });
}
