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
 * У «Номерного фонда» семь источников (сводка, места, категории, динамика, занятость, каналы и их сопоставление,
 * 09.10.2026) плюс оболочка: бюджет 12 и отсутствие повторов, как у «Каналов».
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

/**
 * Счёт идёт с `__test/reset`, а счётчик фикстуры общий для всего стенда. Серверный рендер предыдущего спека
 * в той же части набора мог ещё дописывать свои запросы, и они попадали в счёт этого экрана: /today идёт первым
 * в файле и на main дважды поймал чужой `/hotel/settings` (39307259722, 39319485759), а отдельно, шесть раз
 * подряд, был чист (ui-snapshots settings-diagnostic 39330975247). Перед сбросом ждём, пока стенд замолчит:
 * правило «один запрос на путь» прежнее, из счёта уходят только чужие хвосты.
 */
async function quiet(request: import('@playwright/test').APIRequestContext): Promise<void> {
  let last = (await hits(request)).total;
  for (let i = 0; i < 20; i++) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const now = (await hits(request)).total;
    if (now === last) return;
    last = now;
  }
  throw new Error('подставной API не замолчал за 10 с: счёт экрана был бы чужим');
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
  // «Загрузка конкурентов» (ADR-142): одна сводка /market/occupancy; история ночи только при открытой панели
  '/market',
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
  // «Справочники» (ADR-185): способы оплаты и статьи кассы по одному запросу
  '/hotel-settings/directories',
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
    await quiet(request);
    await request.post(`${API}/__test/reset`);
    await page.goto(screen);
    await page.waitForLoadState('networkidle');
    const { byRequest } = await hits(request);
    const seen = JSON.stringify(byRequest);
    const shell = (key: string) => SHELL.includes(key.split(' ')[1]!.split('?')[0]!);
    const twice = Object.entries(byRequest).filter(([key, n]) => n > 1 && !shell(key));
    // опрос оболочки (свежесть каналов) может сходить второй раз за показ, повтор ему разрешён выше; в бюджет экрана
    // он идёт один раз, иначе итог зависел бы от того, успел ли таймер оболочки сработать до `networkidle`
    const total = Object.entries(byRequest).reduce((sum, [key, n]) => sum + (shell(key) ? 1 : n), 0);
    expect(twice, `путь с данными запрошен повторно за один показ ${screen}: ${seen}`).toEqual([]);
    // «Финансы» с 13.10 денежный экран эталона (ADR-180): отчёт, долги, операции, касса, услуги,
    // прошлый отрезок операций и отчёта для сравнений плиток; «Главная» /today спрашивает свои
    // источники (день, доска, прогноз, сторож). Старый счёт слитого экрана:
    // источникам кассы добавились блоки бывшей Главной (/chessboard, /desk/dashboard за прогноз и
    // за вчера, /desk/today, /guard/status) и прошлый отрезок операций для сравнений плиток;
    // каждый путь по-прежнему спрашивается один раз
    expect(total, `запросов на экран ${screen}: ${seen}`).toBeLessThanOrEqual(
      screen === '/finance' || screen === '/today' ? 11 : ['/channels', '/channels/sync', '/inventory'].includes(screen) ? 12 : 10,
    );
  });
}
