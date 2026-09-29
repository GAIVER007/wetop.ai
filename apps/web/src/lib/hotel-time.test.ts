import { afterEach, expect, it, vi } from 'vitest';

/**
 * «Сегодня» стойки на сервере (С-13, ТЗ аудита 25.09.2026): пояс — из настроек объекта (`/hotel/settings`,
 * тот же запрос, что макет делает на каждой странице), а не сдвиг UTC+5 и не 'Asia/Almaty' в коде.
 * API не ответил — пояс платформы: экран не падает, как не падал заголовок объекта в макете.
 */
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetModules();
});

const settings = (timezone: string) =>
  new Response(
    JSON.stringify({
      property: {
        id: 'p-1',
        name: 'Тестовая гостиница',
        legalName: null,
        address: null,
        timezone,
        currency: 'KZT',
        checkInTime: '14:00',
        checkOutTime: '12:00',
      },
      ratePlans: [],
    }),
  );

// 19:30 UTC 30 сентября: в Алматы уже 1 октября, в Нью-Йорке ещё 30 сентября
const NOW = new Date('2026-09-30T19:30:00Z');

it('«сегодня» стойки — по поясу объекта из /hotel/settings, а не по UTC+5', async () => {
  // таймер предела тоже поддельный: под нагрузкой ответ настроек мог прийти позже секунды настоящего времени,
  // и тест проигрывал `TIMEZONE_WAIT_MS` (падал 28.09 в полном unit дважды); предел проверяет тест ниже
  vi.useFakeTimers({ now: NOW, toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  // новый ответ на каждый вызов: вне RSC `cache` не запоминает, и тело одного Response читается один раз
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => settings('America/New_York')),
  );
  const { hotelClock, hotelToday } = await import('./hotel-api');
  expect(await hotelToday()).toBe('2026-09-30');
  const clock = await hotelClock();
  expect(clock.timezone).toBe('America/New_York');
  expect(clock.month()).toBe('2026-09');
});

it('API не ответил — пояс платформы, страница не падает', async () => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 503 })),
  );
  const { hotelToday } = await import('./hotel-api');
  expect(await hotelToday()).toBe('2026-10-01');
});

/**
 * Страница не ждёт настроек объекта дольше предела (поручение владельца 16.09: «выбираю период и нифига не
 * открывает» — главная открывается, даже когда настройки гостиницы задерживаются). Ради пояса ждём не дольше
 * `TIMEZONE_WAIT_MS`, дальше — пояс платформы, как было до С-13.
 */
it('настройки не ответили в срок — пояс платформы, страница не ждёт', async () => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => {})),
  );
  const { TIMEZONE_WAIT_MS, hotelToday } = await import('./hotel-api');
  const today = hotelToday();
  await vi.advanceTimersByTimeAsync(TIMEZONE_WAIT_MS);
  await expect(today).resolves.toBe('2026-10-01');
});
