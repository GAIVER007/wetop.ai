import { FIXTURE_API, expect, test } from './fixtures';

const API = FIXTURE_API;
test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

test('ошибка стойки показывается сразу, даже если шахматка ещё грузится', async ({
  page,
  request,
}) => {
  await page.goto('/finance');
  await request.post(`${API}/__test/control`, {
    data: {
      failPath: '/desk/today',
      delayPath: '/chessboard',
      delayMs: 6000,
    },
  });
  await page.goto('/finance', { waitUntil: 'commit' });
  await expect(page.getByTestId('desk-error')).toBeVisible({ timeout: 2500 });
});

test('«Финансы» показывают блоки, пока настройки гостиницы ещё загружаются', async ({
  page,
  request,
}) => {
  await request.post(`${API}/__test/control`, { data: { holdHotel: true } });
  try {
    await page.goto('/finance', { waitUntil: 'commit' });
    await expect(page.getByRole('heading', { name: 'Обзор бизнеса', exact: true })).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId('owner-risks')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.workspace-header .workspace-property')).toContainText(
      'Объект не загружен',
    );
  } finally {
    await request.post(`${API}/__test/control`, { data: { holdHotel: false } });
  }
  await expect(page.locator('.workspace-header .workspace-property')).toContainText('Luxx Aparts');
});

test('стойка и её шахматка запрашиваются параллельно', async ({ page, request }) => {
  await page.goto('/finance'); // компиляция next dev не входит в бюджет
  await request.post(`${API}/__test/reset`);
  await request.post(`${API}/__test/control`, {
    data: { delayPath: '/desk/today', delayMs: 5000 },
  });
  await page.goto('/finance', { waitUntil: 'commit' });
  await expect
    .poll(async () => {
      const hits = await (await request.get(`${API}/__test/hits`)).json();
      return hits.byPath['/desk/today'] ?? 0;
    })
    .toBe(1);
  await expect
    .poll(
      async () => {
        const hits = await (await request.get(`${API}/__test/hits`)).json();
        return hits.byPath['/chessboard'] ?? 0;
      },
      { timeout: 2000 },
    )
    .toBe(1);
  await expect(page.getByTestId('owner-risks')).toBeVisible();
});

test('мобильное меню использует уже загруженную свежесть без второго опроса', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/freshness', async (route) => {
    calls++;
    await route.fulfill({
      json: {
        checkedAt: new Date().toISOString(),
        channex: { lastEventAt: null, outboxPending: 7, outboxFailed: 0, oldestPendingAt: null },
      },
    });
  });
  await page.goto('/finance');
  await expect(page.locator('.sidenav [data-testid="data-freshness"]')).toContainText(
    'очередь 7',
  );
  const before = calls;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Навигация' }).getByTestId('data-freshness'),
  ).toContainText('очередь 7');
  expect(calls).toBe(before);
});

test('замер: блоки «Финансов» при задержке настроек 2000 мс', async ({ page, request }, testInfo) => {
  await page.goto('/finance');
  const samples: Array<Record<string, number>> = [];
  for (let pass = 0; pass < 3; pass++) {
    await request.post(`${API}/__test/control`, {
      data: { delayPath: '/hotel/settings', delayMs: 2000 },
    });
    const start = performance.now();
    await page.goto('/finance', { waitUntil: 'commit' });
    const sample: Record<string, number> = {};
    await Promise.all(
      [
        ['heading', page.getByRole('heading', { name: 'Обзор бизнеса', exact: true })],
        ['money', page.getByTestId('cash-period-income')],
        ['risks', page.getByTestId('owner-risks')],
      ].map(async ([key, locator]) => {
        await expect(locator as import('@playwright/test').Locator).toBeVisible();
        sample[key as string] = Math.round(performance.now() - start);
      }),
    );
    samples.push(sample);
    await page.waitForLoadState('load');
  }
  console.log(`TODAY_LOADING_MS ${JSON.stringify(samples)}`);
  await testInfo.attach('today-loading-ms.json', {
    body: JSON.stringify(samples),
    contentType: 'application/json',
  });
});

test('фоновый опрос не перекрывается и восстанавливается после отказа', async ({ page }) => {
  await page.clock.install();
  let calls = 0;
  let hold = false;
  let release: (() => void) | undefined;
  let fail = false;
  await page.route('**/api/freshness', async (route) => {
    calls++;
    if (hold)
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    await route.fulfill({
      status: fail ? 503 : 200,
      json: fail
        ? {}
        : {
            checkedAt: new Date().toISOString(),
            channex: {
              lastEventAt: null,
              outboxPending: 0,
              outboxFailed: 0,
              oldestPendingAt: null,
            },
          },
    });
  });
  await page.goto('/finance');
  const status = page.locator('.sidenav [data-testid="data-freshness"]');
  await expect(status).toContainText('очередь 0');
  await expect(status).not.toHaveClass(/freshness--warn/);
  hold = true;
  const before = calls;
  try {
    await page.clock.fastForward(61_000);
    await expect.poll(() => calls).toBe(before + 1);
    await page.clock.fastForward(61_000);
    await page.clock.fastForward(61_000);
    expect(calls).toBe(before + 1);
    fail = true;
  } finally {
    hold = false;
    release?.();
  }
  await expect(status).toHaveClass(/freshness--warn/);
  fail = false;
  await page.clock.fastForward(61_000);
  await expect(status).not.toHaveClass(/freshness--warn/);
  await expect(status).toContainText('очередь 0');
});
