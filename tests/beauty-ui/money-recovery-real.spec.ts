import { randomUUID } from 'node:crypto';
import { createPrismaClient } from '@pms/database';
import { test, expect } from '../ui/fixtures';
import { isLocalDatabase } from '../tools/seed-local';
import { date, seed } from './tz11-helpers';

const url = process.env.DATABASE_URL;
if (!url || !isLocalDatabase(url)) throw new Error('Own synthetic loopback PostgreSQL required');
const db = createPrismaClient(url, 'pms_test');
test.afterAll(async () => db.$disconnect());
for (const width of [390, 1440]) for (const kind of ['pay', 'refund'] as const) {
  test(`money ${kind}: actual Next action/API/DB committed then response lost, exact retry ${width}`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ colorScheme: width === 390 ? 'dark' : 'light', reducedMotion: 'reduce' });
    const f = await seed(page, request);
    const day = await f.book('10:00', 0, 0, 'Тест денежный повтор');
    const id: string = day.appointments[0].id;
    if (kind === 'refund') {
      await f.call(`/beauty/appointments/${id}/payments`, { method: 'CASH', amount: 300000, idempotencyKey: randomUUID() });
      await f.call(`/beauty/appointments/${id}/status`, { status: 'DONE' });
    }
    await page.goto(`/appointments?date=${date}&appointment=${id}`);
    const card = page.getByRole('dialog', { name: 'Запись', exact: true });
    await expect(card).toBeVisible();
    const region = card.getByRole('region', { name: kind === 'pay' ? 'Оплата записи' : 'Возврат по записи', exact: true });
    await region.getByLabel(kind === 'pay' ? 'Сумма, ₸' : 'Сумма возврата, ₸', { exact: true }).fill(kind === 'pay' ? '3000' : '1000');
    if (kind === 'refund') await region.getByLabel('Причина', { exact: true }).fill('  Вымышленная причина денежного повтора  ');
    // Считаем только денежную команду этой записи: карточка сама зовёт и другие серверные действия (способы оплаты
    // филиала §21.7, данные клиента), и обрывался их ответ, а не оплаты (CI #807 23.10.2026). Аргументы
    // денежного действия начинаются с номера записи.
    let first = true; let commands = 0;
    await page.route((target) => target.pathname === '/appointments', async (route) => {
      if (route.request().method() !== 'POST' || !route.request().headers()['next-action']) return route.continue();
      if (!(route.request().postData() ?? '').startsWith(`["${id}"`)) return route.continue();
      commands++;
      if (!first) return route.continue();
      first = false;
      // Let the actual server action and actual API commit; drop only its browser response.
      const response = await route.fetch();
      expect(response.ok()).toBeTruthy();
      await route.abort('failed');
    });
    await region.getByRole('button', { name: kind === 'pay' ? 'Принять оплату' : 'Оформить возврат', exact: true }).click();
    const retry = card.getByRole('button', { name: 'Повторить ту же операцию', exact: true });
    await expect(retry).toBeVisible();
    await expect(region.getByLabel(kind === 'pay' ? 'Сумма, ₸' : 'Сумма возврата, ₸', { exact: true })).toBeDisabled();
    const expected = kind === 'pay'
      ? [['INCOME', 300000n]]
      : [['INCOME', 300000n], ['EXPENSE', 100000n]];
    const operations = () => db.restaurantCashOperation.findMany({ where: { appointmentId: id }, orderBy: { createdAt: 'asc' } });
    const before = await operations();
    expect(before.map((op) => [op.kind, op.amount])).toEqual(expected);
    const storage = await page.evaluate(() => JSON.stringify({ ...sessionStorage }));
    expect(storage).not.toContain('Вымышленная причина'); expect(storage).not.toContain('Тест денежный повтор');
    await retry.click(); await expect(card).toBeHidden();
    const after = await operations();
    expect(after.map((op) => ({ id: op.id, kind: op.kind, amount: op.amount, note: op.note })))
      .toEqual(before.map((op) => ({ id: op.id, kind: op.kind, amount: op.amount, note: op.note })));
    expect(commands).toBe(2);
    // Fresh load of the journal without the card: page.reload() raced the client-side address replace and
    // reopened the card over the row (CI 39661442107, 39665328615: dialog intercepted the click).
    await page.goto(`/appointments?date=${date}`);
    await expect(card).toBeHidden();
    await page.getByRole('button', { name: 'Тест денежный повтор', exact: true }).click();
    await expect(card.getByTestId('beauty-card-paid')).toHaveText('3 000 ₸ из 12 000 ₸');
    if (kind === 'refund') await expect(card.getByTestId('beauty-card-refunded')).toHaveText('1 000 ₸');
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.startsWith('wetop:beauty:money:')).length)).toBe(0);
  });
}
