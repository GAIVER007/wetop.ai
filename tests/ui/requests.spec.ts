import { FIXTURE_API, expect, test } from './fixtures';

/**
 * Сколько рейсов к API стоит один экран. Разбор «всё тормозит» (16.09.2026): база в Сингапуре, стойка в
 * Алматы, каждый лишний запрос — задержка сети на пустом месте. Счётчик в фикстуре (`/__test/hits`)
 * показывает правду по каждому пути.
 *
 * Правило: одинаковый GET с теми же параметрами не повторяется. Открытые неисправности и история —
 * разные выборки, хотя pathname общий. Прежний бюджет десять запросов сохранён для прежних экранов.
 * У «Обзора» /channels восемь источников данных (с наблюдаемыми каналами по Q-205), у «Синхронизации»
 * шесть, плюс четыре запроса оболочки в dev: их бюджет 12. Это не основание удалять нужные проверки
 * Channex ради числа в тесте.
 * Два пути исключены намеренно: `/system/freshness` браузер опрашивает сам раз в минуту, а `/auth/me`
 * рисуется в двух местах оболочки (панель и меню профиля); плюс стенд работает на `next dev`, где React
 * умышленно вызывает эффекты и рендер по два раза — это шум разработки, а не рейсы живой стойки.
 *
 * Старые адреса `/hotel-settings/{check-in,description,penalties,photos,amenities}` здесь не считаются: это не
 * экраны, а redirect() на «Настройки объекта», «Цены» и «Интеграции». Переадресация по определению проходит
 * оболочку дважды — уходящий рендер и целевой, — и удвоение видно даже там, где экран берёт данные
 * один раз. Сами экраны-получатели в списке есть, а сама переадресация проверена в
 * tests/ui/settings-simplification.spec.ts (разбор 21.09.2026).
 */
interface Hits {
  total: number;
  byPath: Record<string, number>;
  byRequest: Record<string, number>;
}

// адрес подставного API настраиваем: прогон на своих портах не ждёт общий стенд 4311 (приём support-queue)
const API = FIXTURE_API;
const SHELL = ['/system/freshness', '/auth/me'];

async function hits(request: import('@playwright/test').APIRequestContext): Promise<Hits> {
  const res = await request.get(`${API}/__test/hits`);
  expect(res.ok(), 'фикстура не отдала счётчик запросов').toBe(true);
  return (await res.json()) as Hits;
}

for (const screen of [
  '/today',
  '/chessboard',
  '/reservations',
  '/guests',
  // /rooms с PR #66 — переход в /inventory: проверяется сам /inventory
  '/inventory',
  '/rooms/categories',
  '/rooms/availability',
  '/management/analytics',
  '/management/analytics/occupancy',
  // «По номерам» (REP3): один запрос /desk/dashboard/units
  '/management/analytics/units',
  '/finance',
  // хаб «Отчёты» (REP1): четыре источника данных, каждый — одним запросом
  '/reports',
  // печатные формы дня (REP4): один /desk/today на лист
  '/reports/print?form=day',
  '/channels',
  // «Подключения» каналов — redirect() на страницу настроек Channex (INT2): считается сам целевой экран
  '/connections/channex',
  '/channels/mapping',
  '/channels/sync',
  '/channels/events',
  // хаб «Маркетинг» (MKT2): статичная страница, данных не спрашивает
  '/marketing',
  '/website',
  '/website/booking',
  '/website/analytics',
  '/hotel-settings',
  '/hotel-settings/stay',
  '/hotel-settings/services',
  // «Сотрудники» (TEAM1): люди и приглашения — по одному запросу
  '/team',
  '/connections',
  // каталог «ИИ-агентов» (SA1): один запрос каталога, бот и объект API опрашивает сам
  '/ai-agents',
  '/website/settings',
  '/incidents',
  '/journal',
  '/reservations/new?unit=M03',
]) {
  test(`экран ${screen}: данные берутся одним запросом на путь`, async ({ page, request }) => {
    await request.post(`${API}/__test/reset`);
    await page.goto(screen);
    await page.waitForLoadState('networkidle');
    const { total, byRequest } = await hits(request);
    const seen = JSON.stringify(byRequest);
    const twice = Object.entries(byRequest).filter(
      ([key, n]) => n > 1 && !SHELL.includes(key.split(' ')[1]!.split('?')[0]!),
    );
    expect(twice, `путь с данными запрошен повторно за один показ ${screen}: ${seen}`).toEqual([]);
    expect(total, `запросов на экран ${screen}: ${seen}`).toBeLessThanOrEqual(
      ['/channels', '/channels/sync'].includes(screen) ? 12 : 10,
    );
  });
}
