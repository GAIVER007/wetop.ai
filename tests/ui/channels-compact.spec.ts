import { expect, test } from '@playwright/test';
const fixture = 'http://127.0.0.1:4311';
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});
test('обзор каналов: состояние, период и таблица помещаются на ноутбуке', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, { data: { showcase: true } });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/channels');
  await expect(page.getByRole('main').getByTestId('channel-report')).toBeVisible();
  await page.getByRole('button', { name: 'Переключить тему', exact: true }).click();
  await page.screenshot({
    path: 'reports/channels-compact-2026-09-30/desktop-dark.png',
    fullPage: true,
    animations: 'disabled',
  });
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(
    true,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
});
test('нет подключения: пустая очередь не выдаётся за успешную отправку', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, {
    data: {
      channelsOverrides: {
        connection: {
          propertyAccessible: false,
          state: 'NO_MAPPING',
          mappedCategories: 0,
          message: 'Объект не сопоставлен',
        },
        outbox: { pending: 0, failed: 0 },
      },
    },
  });
  await page.goto('/channels');
  await expect(page.getByTestId('channels-state')).toHaveText('не подключены');
  await expect(page.getByRole('main')).not.toContainText('всё ушло в каналы');
});
test('доступ к API в staging не выдаётся за работающий обмен с OTA', async ({ page }) => {
  await page.goto('/channels');
  await expect(page.getByTestId('channels-state')).not.toHaveText('работает');
  await expect(page.getByRole('main')).not.toContainText(
    'Цены, остатки и брони ходят между WETOP и каналами',
  );
});

test('sync never calls an empty disconnected queue successful', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, {
    data: {
      channelsOverrides: {
        connection: { propertyAccessible: false, state: 'NO_MAPPING', mappedCategories: 0 },
        outbox: { pending: 0, failed: 0, sent: 0, lastSentAt: null },
      },
    },
  });
  await page.goto('/channels/sync');
  await expect(page.getByRole('main')).toContainText('Каналы не подключены');
  await expect(page.getByTestId('sync-kinds')).not.toContainText('актуально');
  await expect(page.getByRole('main')).not.toContainText('принимаются');
  await expect(page.getByRole('main')).not.toContainText('всё ушло в каналы');
});
