import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API, expect, test } from './fixtures';

/**
 * «Диалоги» ИИ-продавца в три колонки (SALES2.6, макет владельца 09.10.2026): список, переписка, карточка гостя;
 * поиск по имени и отбор по каналу. Ответственного, следующего шага и заметок нет: им нужна модель (решение владельца).
 */
const API = FIXTURE_API;
const SHOTS = 'reports/sales2-dialogs-2026-10-09';
const DIALOG = '3f2a1b0c-9d8e-4f7a-8b6c-5d4e3f2a1b0c';

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

test('три колонки на широком экране: список, переписка, карточка гостя', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/ai-seller/dialogs');
  await page.getByRole('link', { name: 'А***' }).click();
  const list = page.getByTestId('seller-dialogs');
  const chat = page.getByTestId('seller-dialog-card');
  const client = page.getByTestId('seller-dialog-client');
  await expect(chat).toBeVisible();
  const [a, b, c] = await Promise.all([list.boundingBox(), chat.boundingBox(), client.boundingBox()]);
  expect(a!.x).toBeLessThan(b!.x);
  expect(b!.x).toBeLessThan(c!.x);
  // колонки в одном ряду: верх переписки и карточки не ниже низа списка
  expect(Math.abs(b!.y - c!.y)).toBeLessThan(4);
  await expect(client).toContainText('Телефон');
  await expect(client).toContainText('Ответственного, следующего шага и заметок пока нет');
  await expect(page.getByRole('row', { name: /А\*\*\*/ })).toHaveAttribute('aria-selected', 'true');
});

test('без выбранного диалога справа подсказка, а не пустота', async ({ page }) => {
  await page.goto('/ai-seller/dialogs');
  await expect(page.getByTestId('seller-dialog-pick')).toContainText('Выберите диалог слева');
});

test('поиск по имени оставляет подходящие строки, ненайденное говорит словами, сброс возвращает всё', async ({
  page,
}) => {
  await page.goto('/ai-seller/dialogs');
  await expect(page.getByTestId('seller-dialogs').getByRole('row')).toHaveCount(3);
  await page.getByRole('textbox', { name: 'Имя гостя' }).fill('А');
  await page.getByTestId('seller-dialogs-search').getByRole('button', { name: 'Найти' }).click();
  await expect(page).toHaveURL(/q=/);
  await expect(page.getByTestId('seller-dialogs').getByRole('row')).toHaveCount(2);
  await page.getByRole('textbox', { name: 'Имя гостя' }).fill('Яяя');
  await page.getByTestId('seller-dialogs-search').getByRole('button', { name: 'Найти' }).click();
  await expect(page.getByTestId('seller-dialogs-none')).toContainText('По такому отбору диалогов нет');
  await page.getByRole('link', { name: 'Сбросить' }).click();
  await expect(page.getByTestId('seller-dialogs').getByRole('row')).toHaveCount(3);
});

test('канал в адресе отбирает диалоги; режим и поиск сохраняются в ссылках отбора', async ({ page }) => {
  await page.goto('/ai-seller/dialogs?channel=whatsapp');
  await expect(page.getByTestId('seller-dialogs-none')).toBeVisible();
  await page.goto('/ai-seller/dialogs?q=А');
  await page.getByRole('navigation', { name: 'Отбор диалогов' }).getByRole('link', { name: 'Нужен человек' }).click();
  await expect(page).toHaveURL(/mode=needs_human/);
  await expect(page).toHaveURL(/q=/);
});

for (const theme of ['light', 'dark'] as const) {
  for (const width of [1440, 390]) {
    test(`доступность и снимки: ${theme}, ${width}px`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/ai-seller/dialogs?id=${DIALOG}`);
      await expect(page.getByTestId('seller-dialog-client')).toBeVisible();
      const scan = await new AxeBuilder({ page }).analyze();
      expect(scan.violations.map((v) => v.id)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: `${SHOTS}/dialogs-${theme}-${width}.png`, fullPage: true });
    });
  }
}
