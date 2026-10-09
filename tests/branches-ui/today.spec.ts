import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  beautyToday,
  foodToday,
  localMinute,
  UNAVAILABLE_MASTER,
} from '../../apps/web/src/app/today/vertical-metrics';
import { previousDate } from '../../apps/web/src/lib/food-data';
import { instantOf } from '../../apps/web/src/app/beauty/time';

/**
 * MV8 Vertical Today на настоящем API: BranchesController, RoleGuard, AuthorInterceptor, Beauty и Food модули,
 * изолированная PostgreSQL. Синтетические только вход и строки базы; ответы домена не подменяются. Ожидаемые числа
 * тест считает из ответа того же API за тот же день филиала.
 */
const api = `http://127.0.0.1:${process.env.BRANCHES_UI_API_PORT ?? '55864'}`;
const shots = 'reports/mv8-vertical-today-2026-10-06/screenshots';
type Fixture = {
  business: string;
  beauty: string;
  hotel: string;
  locations: string[];
};
const pointer = (b: string, l: string) => `business=${b};location=${l}`;
const setScope = (page: Page, value: string) =>
  page
    .context()
    .addCookies([
      { name: 'wetop_scope', value: encodeURIComponent(value), domain: '127.0.0.1', path: '/' },
    ]);
const scopeCookie = async (page: Page) =>
  decodeURIComponent(
    (await page.context().cookies()).find((c) => c.name === 'wetop_scope')?.value ?? '',
  );
async function prepare(request: APIRequestContext, timezone?: string) {
  const reset = await request.post(`${api}/__test/reset`);
  expect(reset.ok()).toBe(true);
  const f: Fixture = await reset.json();
  const seeded = await request.post(`${api}/__test/seed-today`, { data: { timezone } });
  expect(seeded.ok(), await seeded.text()).toBe(true);
  const s: { localDay: string; timezone: string } = await seeded.json();
  return {
    ...f,
    ...s,
    food: pointer(f.business, f.locations[0]!),
    salon: pointer(f.beauty, f.locations[3]!),
    hotelScope: pointer(f.hotel, f.locations[4]!),
  };
}
async function choose(page: Page, name: string) {
  await page.getByRole('button', { name: 'Выбрать филиал', exact: true }).click();
  await page
    .getByRole('region', { name: 'Выбор филиала' })
    .getByRole('button')
    .filter({ hasText: name })
    .click();
}
const callsSince = async (request: APIRequestContext, from: number) =>
  ((await (await request.get(`${api}/__test/calls`)).json()) as string[]).slice(from);
const callCount = async (request: APIRequestContext) =>
  ((await (await request.get(`${api}/__test/calls`)).json()) as string[]).length;
async function all<T>(request: APIRequestContext, scope: string, path: string): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | null = null;
  do {
    const q = new URLSearchParams(path.includes('?') ? path.split('?')[1] : '');
    q.set('limit', '100');
    if (cursor) q.set('cursor', cursor);
    const res = await request.get(`${api}${path.split('?')[0]}?${q}`, {
      headers: { 'x-wetop-scope': scope },
    });
    expect(res.ok()).toBe(true);
    const page = await res.json();
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return items;
}
async function expectedFood(
  request: APIRequestContext,
  scope: string,
  localDay: string,
  timezone: string,
) {
  const [areas, tables, today, previous] = await Promise.all([
    all(request, scope, '/food-service/areas'),
    all(request, scope, '/food-service/tables'),
    all(request, scope, `/food-service/reservations?date=${localDay}`),
    all(request, scope, `/food-service/reservations?date=${previousDate(localDay)}`),
  ]);
  return foodToday({
    areas,
    tables,
    today,
    previous,
    dayStart: instantOf(`${localDay}T00:00`, timezone),
    capturedNow: new Date().toISOString(),
  } as Parameters<typeof foodToday>[0]);
}
async function expectedBeauty(request: APIRequestContext, scope: string) {
  const res = await request.get(`${api}/beauty/appointments`, {
    headers: { 'x-wetop-scope': scope },
  });
  expect(res.ok()).toBe(true);
  const day = await res.json();
  return {
    day,
    m: beautyToday(day, localMinute(new Date().toISOString(), day.location.timezone)),
  };
}
const value = (page: Page, id: string) => page.getByTestId(id);

/** Окно гостиничного обучения поверх Главной перехватило бы щелчки: пройденным оно не считается только в своём тесте */
test.beforeEach(async ({ page }, info) => {
  if (info.title.includes('обучение само открывается')) return;
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key: string) {
      const v = get.call(this, key);
      return v === null && key.startsWith('wetop.tour.v1:') ? 'done' : v;
    };
  });
});

test.afterAll(async ({ request }) => {
  expect((await request.post(`${api}/__test/cleanup`)).ok()).toBe(true);
});

test.describe('MV8: «Сегодня» салона и ресторана на настоящем API', () => {
  test('салон: числа экрана равны ответу API дня, мастер без столбца назван, только запрос дня', async ({
    page,
    request,
  }) => {
    const f = await prepare(request);
    await setScope(page, f.salon);
    const from = await callCount(request);
    await page.goto('/today');
    await expect(page.getByRole('heading', { name: 'Сегодня', exact: true })).toBeVisible();
    await expect(page.getByTestId('beauty-today')).toBeVisible();
    const { m } = await expectedBeauty(request, f.salon);
    expect(m.masters).toBe(2);
    for (const [id, n] of [
      ['today-planned', m.planned],
      ['today-confirmed', m.confirmed],
      ['today-done', m.done],
      ['today-masters', m.masters],
    ] as const)
      await expect(value(page, id), id).toHaveText(String(n));
    if (m.awaitingConfirmation > 0)
      await expect(page.getByTestId('today-attention-unconfirmed')).toContainText(
        String(m.awaitingConfirmation),
      );
    if (m.noShow > 0)
      await expect(page.getByTestId('today-attention-no-show')).toContainText(String(m.noShow));
    await expect(page.getByText('Мастеров', { exact: true })).toBeVisible();
    const rows = page.getByTestId('today-upcoming').locator('li');
    await expect(rows).toHaveCount(m.upcoming.length);
    if (m.upcoming.some((u) => u.master === UNAVAILABLE_MASTER))
      await expect(page.getByTestId('today-upcoming')).toContainText(UNAVAILABLE_MASTER);
    // меню салона: «Сегодня» первым пунктом и текущим
    await expect(page.getByRole('link', { name: 'Сегодня', exact: true }).first()).toHaveAttribute(
      'aria-current',
      'page',
    );
    const calls = await callsSince(request, from);
    expect(calls.filter((c) => c.startsWith('/beauty/'))).toEqual(
      calls.filter((c) => c === '/beauty/appointments'),
    );
    expect(calls.some((c) => /^\/(food-service|desk|hotel|chessboard|finance)\b/.test(c))).toBe(
      false,
    );
  });

  test('ресторан: больше 100 броней, бронь через полночь, закрытые столы; только залы, столы и брони', async ({
    page,
    request,
  }) => {
    const f = await prepare(request);
    await setScope(page, f.food);
    const from = await callCount(request);
    await page.goto('/today');
    await expect(page.getByTestId('food-today')).toBeVisible();
    const m = await expectedFood(request, f.food, f.localDay, f.timezone);
    expect(m.planned).toBeGreaterThan(100);
    expect(m.seatedNow).toBeGreaterThanOrEqual(2);
    expect(m.activeTables).toBe(3);
    for (const [id, n] of [
      ['today-planned', m.planned],
      ['today-seated', m.seatedNow],
      ['today-completed', m.completed],
      ['today-free', m.freeNow],
    ] as const)
      await expect(value(page, id), id).toHaveText(String(n));
    for (const [id, n] of [
      ['today-attention-unconfirmed', m.awaitingConfirmation],
      ['today-attention-no-show', m.noShow],
    ] as const)
      await expect(page.getByTestId(id), id).toContainText(String(n));
    await expect(page.getByText(`из ${m.activeTables}`, { exact: true })).toBeVisible();
    await expect(page.getByTestId('today-attention-no-table')).toContainText(
      String(m.withoutTable),
    );
    await expect(
      page.getByRole('link', { name: 'Бронирования', exact: true }).first(),
    ).toBeVisible();
    const calls = await callsSince(request, from);
    expect(calls.some((c) => /^\/(beauty|desk|hotel|chessboard|finance)\b/.test(c))).toBe(false);
    expect(calls.filter((c) => c === '/food-service/reservations').length).toBeGreaterThanOrEqual(
      3,
    );
    expect(calls).not.toContain('/food-service/customers');
    expect(calls).not.toContain('/food-service/service-periods');
  });

  test('граница суток: день ресторана берётся по его поясу, а не по UTC', async ({
    page,
    request,
  }) => {
    const f = await prepare(request, 'Pacific/Kiritimati');
    await setScope(page, f.food);
    await page.goto('/today');
    await expect(page.getByTestId('food-today')).toBeVisible();
    const local = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Kiritimati' }).format(
      new Date(),
    );
    expect(f.localDay).toBe(local);
    const m = await expectedFood(request, f.food, f.localDay, f.timezone);
    expect(m.planned).toBeGreaterThan(100);
    await expect(value(page, 'today-planned')).toHaveText(String(m.planned));
  });

  test('переключения Салон → Ресторан → Гостиница → Салон, быстрое переключение и обновление страницы', async ({
    page,
    request,
  }) => {
    const f = await prepare(request);
    await setScope(page, f.salon);
    await page.goto('/today');
    await expect(page.getByTestId('beauty-today')).toBeVisible();
    await choose(page, 'Тестовый филиал Центр');
    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByTestId('food-today')).toBeVisible();
    await expect(page.getByTestId('beauty-today')).toHaveCount(0);
    expect(await scopeCookie(page)).toBe(f.food);
    await choose(page, 'Тестовый отель');
    // гостиница с 09.10 живёт единым разделом «Финансы»: /today уводит туда (finance-home-merge)
    await expect(page).toHaveURL(/\/finance$/);
    await expect(page.getByTestId('owner-dashboard')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Обзор бизнеса', exact: true })).toBeVisible();
    await expect(page.getByTestId('food-today')).toHaveCount(0);
    await choose(page, 'Тестовый салон');
    await expect(page.getByTestId('beauty-today')).toBeVisible();
    await expect(page.getByTestId('owner-dashboard')).toHaveCount(0);
    expect(await scopeCookie(page)).toBe(f.salon);
    await page.reload();
    await expect(page.getByTestId('beauty-today')).toBeVisible();
    expect(await scopeCookie(page)).toBe(f.salon);
    // быстро: ресторан и сразу салон, не дожидаясь первого экрана; побеждает последний выбор
    await choose(page, 'Тестовый филиал Центр');
    await choose(page, 'Тестовый салон');
    await expect(page.getByTestId('beauty-today')).toBeVisible();
    await expect(page.getByTestId('food-today')).toHaveCount(0);
    expect(await scopeCookie(page)).toBe(f.salon);
    await page.reload();
    await expect(page.getByTestId('beauty-today')).toBeVisible();
    // корень и выбор с одним филиалом тоже ведут на /today
    await page.goto('/');
    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByTestId('beauty-today')).toBeVisible();
  });

  test('во время переключения старые данные дня скрыты до ответа настоящего server action', async ({
    page,
    request,
  }) => {
    const f = await prepare(request);
    await setScope(page, f.salon);
    await page.goto('/today');
    await expect(page.getByTestId('beauty-today')).toBeVisible();
    await page.getByRole('button', { name: 'Выбрать филиал', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Выбор филиала' })).toBeVisible();
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const held = new Promise<void>((resolve) => {
      started = resolve;
    });
    await page.route('**/today', async (route) => {
      if (route.request().method() === 'POST' && route.request().headers()['next-action']) {
        started();
        await gate;
      }
      await route.continue();
    });
    try {
      await page
        .getByRole('region', { name: 'Выбор филиала' })
        .getByRole('button')
        .filter({ hasText: 'Тестовый филиал Центр' })
        .click();
      await held;
      await expect(page.getByTestId('beauty-today')).not.toBeVisible();
      await expect(page.locator('#main-content')).toHaveCount(1);
      await page.locator('.skip-link').focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('main')).toBeFocused();
      await expect(
        page.getByRole('button', { name: 'Выбрать филиал', exact: true }),
      ).toBeDisabled();
    } finally {
      release();
    }
    await expect(page.getByTestId('food-today')).toBeVisible();
    await expect(page.getByTestId('beauty-today')).toHaveCount(0);
    expect(await scopeCookie(page)).toBe(f.food);
    await page.reload();
    await expect(page.getByTestId('food-today')).toBeVisible();
  });

  test('pending Hospitality selection stops previous branch freshness polling', async ({
    page,
    request,
  }) => {
    const f = await prepare(request);
    await setScope(page, f.hotelScope);
    await page.clock.install();
    await page.goto('/today');
    await expect(page.getByTestId('owner-dashboard')).toBeVisible();
    await expect(page.getByTestId('data-freshness')).toBeVisible();
    await page.getByRole('button', { name: 'Выбрать филиал', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Выбор филиала' })).toBeVisible();
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const held = new Promise<void>((resolve) => {
      started = resolve;
    });
    await page.route('**/today', async (route) => {
      if (route.request().method() === 'POST' && route.request().headers()['next-action']) {
        started();
        await gate;
      }
      await route.continue();
    });
    const from = await callCount(request);
    try {
      await page
        .getByRole('region', { name: 'Выбор филиала' })
        .getByRole('button')
        .filter({ hasText: 'Тестовый филиал Центр' })
        .click();
      await held;
      await expect(page.getByTestId('owner-dashboard')).not.toBeVisible();
      await page.clock.fastForward(60001);
      // Allow the triggered HTTP poll to reach the real API call journal.
      await page.waitForTimeout(1000);
      expect((await callsSince(request, from)).filter((c) => c === '/system/freshness')).toEqual(
        [],
      );
    } finally {
      release();
    }
    await expect(page.getByTestId('food-today')).toBeVisible();
    expect(await scopeCookie(page)).toBe(f.food);
  });

  test('только чтение и администратор смены: экран дня открыт, числа те же', async ({
    page,
    request,
  }) => {
    const f = await prepare(request);
    for (const control of [{ readOnly: true }, { role: 'STAFF' }]) {
      await request.post(`${api}/__test/control`, { data: control });
      for (const [scope, testId] of [
        [f.food, 'food-today'],
        [f.salon, 'beauty-today'],
      ] as const) {
        await setScope(page, scope);
        await page.goto('/today');
        await expect(page.getByTestId(testId), JSON.stringify(control)).toBeVisible();
        await expect(page.getByTestId('today-error')).toHaveCount(0);
      }
    }
    await request.post(`${api}/__test/control`, { data: {} });
  });

  test('гостиница: блоки владельца в «Финансах», без запросов салона и ресторана', async ({ page, request }) => {
    const f = await prepare(request);
    await setScope(page, f.hotelScope);
    const from = await callCount(request);
    await page.goto('/today');
    await expect(page.getByTestId('owner-dashboard')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Обзор бизнеса', exact: true })).toBeVisible();
    await expect(page.getByTestId('beauty-today')).toHaveCount(0);
    const calls = await callsSince(request, from);
    expect(calls.some((c) => /^\/(beauty|food-service)\b/.test(c))).toBe(false);
  });

  test('без подтверждённого направления гостиница не угадывается: выбор через /scope/resolve или /branches', async ({
    page,
    request,
  }) => {
    const f = await prepare(request);
    // Без scope разрешены только общие reads до выбора филиала.
    const from = await callCount(request);
    // указателя нет: тот же выбор, что после входа; филиалов несколько, поэтому человек выбирает сам
    await page.goto('/today');
    await expect(page).toHaveURL(/\/branches$/);
    await expect(page.getByTestId('owner-dashboard')).toHaveCount(0);
    expect(await scopeCookie(page)).toBe('');
    await page.getByRole('button', { name: 'Выбрать филиал', exact: true }).click();
    await expect(
      page
        .getByRole('region', { name: 'Выбор филиала' })
        .getByRole('button')
        .filter({ hasText: 'Тестовый филиал Центр' }),
    ).toBeVisible();
    expect(
      (await callsSince(request, from)).filter((c) =>
        /^\/(beauty|food-service|desk|hotel|chessboard|finance|system)\b/.test(c),
      ),
    ).toEqual([]);
    // указатель без филиала у салона: направление не подтверждено до Location, свой экран не рисуется
    await setScope(page, `business=${f.beauty}`);
    await page.goto('/today');
    await expect(page).toHaveURL(/\/branches$/);
    await expect(page.getByTestId('beauty-today')).toHaveCount(0);
    await expect(page.getByTestId('owner-dashboard')).toHaveCount(0);
  });

  test('гостиничное обучение само открывается только у гостиницы, у салона и ресторана нет', async ({
    page,
    request,
  }) => {
    const f = await prepare(request);
    await setScope(page, f.hotelScope);
    await page.goto('/today');
    await expect(page.getByRole('dialog')).toBeVisible();
    for (const [scope, testId] of [
      [f.salon, 'beauty-today'],
      [f.food, 'food-today'],
    ] as const) {
      await page.context().clearCookies();
      await page.evaluate(() => localStorage.clear());
      await setScope(page, scope);
      await page.goto('/today');
      await expect(page.getByTestId(testId)).toBeVisible();
      // обучение стартует через 600 мс после отрисовки: ждём с запасом и проверяем, что окна нет
      await page.waitForTimeout(1500);
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
  });

  for (const [vertical, testId] of [
    ['beauty', 'beauty-today'],
    ['food', 'food-today'],
    ['hospitality', 'owner-dashboard'],
  ] as const)
    for (const width of [1440, 390])
      for (const theme of ['light', 'dark'] as const)
        test(`снимок ${vertical} ${width} ${theme}: axe, клавиатура, без прокрутки вбок`, async ({
          page,
          request,
        }) => {
          const f = await prepare(request);
          await setScope(
            page,
            vertical === 'beauty' ? f.salon : vertical === 'food' ? f.food : f.hotelScope,
          );
          await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
          await page.emulateMedia({ colorScheme: theme });
          await page.goto('/today');
          await expect(page.getByTestId(testId)).toBeVisible();
          await expect(page.getByRole('dialog')).toHaveCount(0);
          await page.evaluate(async () => {
            await Promise.all(
              document
                .getAnimations()
                .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
                .map((a) => a.finished.catch(() => undefined)),
            );
          });
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
          ).toBeLessThanOrEqual(1);
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
          await page.screenshot({
            path: `${shots}/today-${vertical}-${width}-${theme}.png`,
            fullPage: true,
          });
          if (vertical !== 'hospitality') {
            const action = page.getByRole('link', {
              name: vertical === 'beauty' ? 'Открыть календарь' : 'Открыть план зала',
              exact: true,
            });
            // с клавиатуры до главного действия экрана доходит Tab, Enter открывает раздел
            for (
              let i = 0;
              i < 60 && !(await action.first().evaluate((el) => el === document.activeElement));
              i++
            )
              await page.keyboard.press('Tab');
            await expect(action.first()).toBeFocused();
          }
        });
});
