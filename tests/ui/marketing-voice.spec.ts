import { mkdirSync } from 'node:fs';
import type { APIRequestContext } from '@playwright/test';
import { FIXTURE_API, expect, test, type Page } from './fixtures';

/**
 * «Продвижение → Голосовой агент» (срез 4): вкладки «Брони по телефону» и «Бронь по телефону» на подставном API.
 * Список без имён и телефонов гостей, выключатель с причинами «почему нельзя», сохранение лимита, пустой и упавший список,
 * скриншоты 1440 и 390 в светлой и тёмной теме. Данные вымышленные (ADR-010).
 */
const API = FIXTURE_API;
const SHOTS = 'reports/voice-desk-2026-10-23';

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

const iso = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3_600_000).toISOString();

async function seed(request: APIRequestContext, over: Record<string, unknown> = {}) {
  await request.post(`${API}/__test/marketing-voice`, {
    data: {
      calls: [
        { id: 'c1', receivedAt: iso(2), callerMasked: '***2233', state: 'ENDED', direction: 'INBOUND', durationSeconds: 140, transferRequested: false, callbackRequested: false, endReason: 'hangup' },
      ],
      bookings: [
        { id: 'b1', kind: 'HOTEL', at: iso(1), status: 'CONFIRMED', reference: 'WT-1', category: 'Стандарт', arrival: '2026-11-20', departure: '2026-11-22', adults: 2, totalMinor: '3000000', currency: 'KZT' },
        { id: 'b2', kind: 'APPOINTMENT', at: iso(3), status: 'BOOKED', service: 'Стрижка', master: 'Алия', startsAt: iso(-48), totalMinor: '500000', currency: 'KZT' },
        { id: 'b3', kind: 'TABLE', at: iso(30), status: 'CANCELLED', startsAt: iso(-72), partySize: 4, period: 'Ужин' },
      ],
      ...over,
    },
  });
}

const openBookings = async (page: Page) => {
  await page.goto('/marketing/voice');
  await expect(page.getByTestId('marketing-voice-screen')).toBeVisible();
  await page.getByRole('tab', { name: /Брони по телефону/ }).click();
};

test('список броней по телефону: вид, что, статус словами, число за сутки; имён и телефонов нет', async ({ page, request }) => {
  await seed(request);
  await openBookings(page);
  const table = page.getByTestId('voice-bookings');
  await expect(table).toBeVisible();
  await expect(table.getByTestId('voice-booking-b1')).toContainText('Номер');
  await expect(table.getByTestId('voice-booking-b1')).toContainText('Стандарт');
  await expect(table.getByTestId('voice-booking-b1')).toContainText('WT-1');
  await expect(table.getByTestId('voice-booking-b1')).toContainText('Подтверждена');
  await expect(table.getByTestId('voice-booking-b2')).toContainText('Стрижка');
  await expect(table.getByTestId('voice-booking-b2')).toContainText('мастер Алия');
  await expect(table.getByTestId('voice-booking-b2')).toContainText('Ждёт подтверждения');
  await expect(table.getByTestId('voice-booking-b3')).toContainText('4 гостя');
  await expect(table.getByTestId('voice-booking-b3')).toContainText('Отменена');
  await expect(page.getByRole('tab', { name: 'Брони по телефону (2)' })).toBeVisible();
  await expect(page.getByTestId('voice-bookings-note')).toContainText('Имена и телефоны гостей смотрите в карточке брони');
  await expect(page.locator('body')).not.toContainText(/\+7\s?\d{3}/);
});

test('нет броней: подсказка; список не ответил: вкладки нет, экран цел', async ({ page, request }) => {
  await seed(request, { bookings: [] });
  await openBookings(page);
  await expect(page.getByTestId('voice-bookings-empty')).toBeVisible();
  await seed(request, { bookingsFail: true });
  await page.goto('/marketing/voice');
  await expect(page.getByTestId('voice-summary')).toBeVisible();
  await expect(page.getByRole('tab', { name: /Брони по телефону/ })).toHaveCount(0);
});

test('вкладка «Бронь по телефону»: причины, почему нельзя включить, и включение с лимитом', async ({ page, request }) => {
  await seed(request, { booking: { canEnable: false, blockers: ['Нет столов в зале'], vertical: 'FOOD_SERVICE' } });
  await page.goto('/marketing/voice');
  await page.getByRole('tab', { name: 'Бронь по телефону', exact: true }).click();
  const form = page.getByTestId('voice-booking');
  await expect(form).toBeVisible();
  await expect(form.getByTestId('voice-booking-blockers')).toContainText('Нет столов в зале');
  await expect(form.getByRole('switch')).toBeDisabled();

  await seed(request, { booking: { canEnable: true, blockers: [] } });
  await page.goto('/marketing/voice');
  await page.getByRole('tab', { name: 'Бронь по телефону', exact: true }).click();
  const ready = page.getByTestId('voice-booking');
  await expect(ready.getByRole('switch')).toBeEnabled();
  await ready.getByRole('switch').check();
  await ready.getByTestId('voice-booking-limit').fill('4');
  await ready.getByTestId('voice-booking-save').click();
  await expect(page.getByText('Бронь по телефону включена')).toBeVisible();
  await page.reload();
  await page.getByRole('tab', { name: 'Бронь по телефону', exact: true }).click();
  await expect(page.getByTestId('voice-booking').getByRole('switch')).toBeChecked();
  await expect(page.getByTestId('voice-booking-limit')).toHaveValue('4');
});

test('лимит за звонок вне 1..20: браузер не отправляет форму, на сервере ничего не изменилось', async ({ page, request }) => {
  await seed(request);
  await page.goto('/marketing/voice');
  await page.getByRole('tab', { name: 'Бронь по телефону', exact: true }).click();
  const form = page.getByTestId('voice-booking');
  const limit = form.getByTestId('voice-booking-limit');
  await limit.fill('50');
  await form.getByTestId('voice-booking-save').click();
  expect(await limit.evaluate((el) => (el as HTMLInputElement).validity.rangeOverflow)).toBe(true);
  const saved = (await (await request.get(`${API}/marketing/voice/booking`, { headers: { 'x-wetop-test-client': '1' } })).json()) as { maxPerCall: number; enabled: boolean };
  expect(saved).toMatchObject({ maxPerCall: 3, enabled: false });
});

test('скриншоты списка и настройки: 1440 и 390, светлая и тёмная тема, без горизонтальной прокрутки', async ({ page, request }) => {
  mkdirSync(SHOTS, { recursive: true });
  await seed(request, { booking: { enabled: true } });
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    for (const [width, height] of [[1440, 900], [390, 844]] as const) {
      await page.setViewportSize({ width, height });
      await openBookings(page);
      await expect(page.getByTestId('voice-bookings')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `${SHOTS}/bookings-${theme}-${width}.png`, fullPage: true });
      await page.getByRole('tab', { name: 'Бронь по телефону', exact: true }).click();
      await expect(page.getByTestId('voice-booking')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `${SHOTS}/settings-${theme}-${width}.png`, fullPage: true });
    }
  }
});
