import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import type { Page, APIRequestContext } from '@playwright/test';

/**
 * Каталог салона в стойке (DATA_MODEL §19.1, срез B3, ADR-139): услуги сети с ценой филиала и мастера с
 * умениями. Проверяется то, за чем приходит человек: услуга появляется, филиал ставит свою цену, мастер
 * получает умения, а снятая галочка снимается.
 */
const SNAPSHOTS = 'reports/beauty-b3-2026-10-03';

async function openSalon(page: Page, request: APIRequestContext) {
  await request.post('http://127.0.0.1:4311/__test/reset');
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await page.goto('/branches');
  const main = page.getByRole('main');
  await main.locator('summary').filter({ hasText: 'Добавить филиал' }).click();
  await main.getByRole('radio', { name: 'Салон красоты или студия' }).check();
  await main.getByLabel('Название филиала').fill('Студия Айна');
  await main.getByRole('button', { name: 'Добавить филиал', exact: true }).click();
  await expect(main.getByRole('status')).toContainText('Салон создан');
  await page.reload();
  await main
    .locator('.branches-grid section')
    .filter({ hasText: 'Студия Айна' })
    .getByRole('button', { name: 'Открыть салон', exact: true })
    .click();
  await page.waitForURL('**/beauty');
}

async function addService(page: Page, name: string, minutes: string, priceMinor: string) {
  await page.goto('/beauty/services');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Добавить услугу', exact: true }).click();
  const panel = page.getByRole('dialog');
  await panel.getByLabel('Название').fill(name);
  await panel.getByLabel(/Длительность, минут/).fill(minutes);
  await panel.getByLabel(/Цена каталога, тиын/).fill(priceMinor);
  await panel.getByRole('button', { name: 'Сохранить услугу', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('Услуга добавлена');
}

test('услуга каталога добавляется и видна в списке', async ({ page, request }) => {
  await openSalon(page, request);
  await addService(page, 'Маникюр', '60', '800000');
  await page.goto('/beauty/services');
  const main = page.getByRole('main');
  const row = main.getByRole('row').filter({ hasText: 'Маникюр' });
  await expect(row).toContainText('60 мин');
  await expect(row).toContainText('8 000');
  // филиал услугу ещё не включил: продавать её нельзя, и экран говорит это словами
  await expect(row).toContainText('Филиал не оказывает');
  await page.screenshot({ path: `${SNAPSHOTS}/services-1440.png`, fullPage: true });
});

test('филиал включает услугу и ставит свою цену', async ({ page, request }) => {
  await openSalon(page, request);
  await addService(page, 'Маникюр', '60', '800000');
  await page.goto('/beauty/services');
  const main = page.getByRole('main');
  await main.getByRole('row').filter({ hasText: 'Маникюр' }).getByRole('button', { name: 'Изменить' }).click();
  const panel = page.getByRole('dialog');
  await panel.getByLabel('Филиал оказывает эту услугу').check();
  await panel.getByLabel(/Своя цена филиала/).fill('950000');
  await panel.getByLabel(/Своя длительность/).fill('90');
  await panel.getByRole('button', { name: 'Сохранить для филиала', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('Настройки филиала сохранены');
  await page.goto('/beauty/services');
  const row = main.getByRole('row').filter({ hasText: 'Маникюр' });
  await expect(row).toContainText('9 500');
  await expect(row).toContainText('90 мин');
  await expect(row).toContainText('своя цена филиала');
});

test('ошибки услуги словами, введённое не стирается', async ({ page, request }) => {
  await openSalon(page, request);
  await page.goto('/beauty/services');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Добавить услугу', exact: true }).click();
  const panel = page.getByRole('dialog');
  await panel.getByLabel('Название').fill('Стрижка');
  await panel.getByLabel(/Длительность, минут/).fill('0');
  await panel.getByLabel(/Цена каталога, тиын/).fill('500000');
  await panel.getByRole('button', { name: 'Сохранить услугу', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('минут больше нуля');
  await expect(panel.getByLabel('Название')).toHaveValue('Стрижка');
  await expect(panel.getByLabel(/Цена каталога, тиын/)).toHaveValue('500000');
});

test('мастер добавляется, умения ставятся и снимаются', async ({ page, request }) => {
  await openSalon(page, request);
  await addService(page, 'Маникюр', '60', '800000');
  await addService(page, 'Стрижка', '45', '500000');
  await page.goto('/beauty/masters');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Добавить мастера', exact: true }).click();
  const panel = page.getByRole('dialog');
  await panel.getByLabel('Имя мастера').fill('Дина');
  await panel.getByRole('checkbox', { name: 'Маникюр' }).check();
  await panel.getByRole('checkbox', { name: 'Стрижка' }).check();
  await panel.getByRole('button', { name: 'Сохранить мастера', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('Мастер добавлен');
  await page.goto('/beauty/masters');
  const row = main.getByRole('row').filter({ hasText: 'Дина' });
  await expect(row).toContainText('Маникюр, Стрижка');
  await expect(row).toContainText('1');
  await page.screenshot({ path: `${SNAPSHOTS}/masters-1440.png`, fullPage: true });

  // снятая галочка должна сниматься, а не копиться
  await row.getByRole('button', { name: 'Изменить' }).click();
  const edit = page.getByRole('dialog');
  await edit.getByRole('checkbox', { name: 'Стрижка' }).uncheck();
  await edit.getByRole('button', { name: 'Сохранить мастера', exact: true }).click();
  await expect(edit.getByRole('status')).toContainText('Мастер сохранён');
  await page.goto('/beauty/masters');
  await expect(main.getByRole('row').filter({ hasText: 'Дина' })).toContainText('Маникюр');
  await expect(main.getByRole('row').filter({ hasText: 'Дина' })).not.toContainText('Стрижка');
});

test('каталог салона на телефоне: без прокрутки вбок', async ({ page, request }) => {
  await openSalon(page, request);
  await addService(page, 'Маникюр', '60', '800000');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['/beauty/services', '/beauty/masters']) {
    await page.goto(path);
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(
      true,
    );
    await page.screenshot({
      path: `${SNAPSHOTS}/${path.split('/').pop()}-390.png`,
      fullPage: true,
    });
  }
});

for (const theme of ['light', 'dark'] as const) {
  test(`каталог салона доступен в ${theme === 'light' ? 'светлой' : 'тёмной'} теме`, async ({
    page,
    request,
  }) => {
    await openSalon(page, request);
    await addService(page, 'Маникюр', '60', '800000');
    await page.emulateMedia({ colorScheme: theme });
    for (const path of ['/beauty/services', '/beauty/masters']) {
      await page.goto(path);
      await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
      const audit = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(audit.violations.map((v) => `${path} ${v.id}: ${v.nodes.length}`)).toEqual([]);
    }
    await page.screenshot({ path: `${SNAPSHOTS}/masters-${theme}.png`, fullPage: true });
  });
}
