import { expect, test, type Page } from './fixtures';

/**
 * Главная, PR A2 (ТЗ `plans/tz-today-2026-09-27.md` §4, §12.1; план `plans/today-a2-2026-09-28.md`):
 * операционные блоки только на существующих данных. Ожидания берутся из того же подставного API,
 * что рисует экран, — тест сверяет экран с данными, а не с заученными числами.
 */
const fixture = 'http://127.0.0.1:4311';

type Row = {
  confirmationNumber: string;
  unitCode: string | null;
  status: string;
  balanceMinor: string;
};
type Day = { date: string; arrivals: Row[]; departures: Row[]; debtMinor: string };
type Board = {
  summary: Record<string, { occupied: number; blocked: number; free: number }>;
  byCategory: Record<string, Record<string, { units: number; occupied: number }>>;
  rows: Array<{
    unit: { code: string; accommodationTypeCode: string; accommodationTypeName: string; housekeepingStatus: string };
    cells: Array<{ state: string; blockType?: string | null }>;
  }>;
};

const asClient = { headers: { 'x-wetop-test-client': '1' } };
const digits = (text: string) => text.replace(/\D/g, '');
const tenge = (minor: string) => String(BigInt(minor) / 100n);

/** Сравнение денег видит владелец; сотрудником стенд делает только вошедшего (`/auth/me` без входа — роли нет) */
async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
}

async function day(page: Page): Promise<Day> {
  return (await page.request.get(`${fixture}/desk/today`, asClient)).json();
}

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('заезды и выезды дня: строка на проживание, действие ведёт в существующий поток', async ({ page }) => {
  const d = await day(page);
  await page.goto('/today');
  const arrivals = page.getByRole('region', { name: 'Заезды' });
  const departures = page.getByRole('region', { name: 'Выезды' });
  // время — объекта, не брони: у брони его нет (пробел плана §3.1)
  await expect(arrivals).toContainText('с 14:00');
  await expect(departures).toContainText('до 12:00');

  const pending = d.arrivals.filter((r) => r.status !== 'CHECKED_IN');
  expect(pending.length).toBeGreaterThan(0);
  for (const r of pending.slice(0, 6)) {
    const row = arrivals.getByTestId('event-row').filter({ hasText: r.confirmationNumber });
    await expect(row).toHaveCount(1);
    if (!r.unitCode) {
      await expect(row).toContainText('без ячейки');
      await expect(row.getByRole('link', { name: 'Назначить' })).toHaveAttribute(
        'href',
        `/chessboard?from=${d.date}&to=${d.date}#unassigned-stays`,
      );
    } else {
      await expect(row.getByRole('link', { name: 'Заселить' })).toHaveAttribute(
        'href',
        `/reservations/${r.confirmationNumber}#booking-actions`,
      );
    }
    if (BigInt(r.balanceMinor) > 0n) {
      await expect(row).toContainText('к оплате');
      expect(digits((await row.textContent()) ?? '')).toContain(tenge(r.balanceMinor));
    }
  }

  const staying = d.departures.filter((r) => r.status === 'CHECKED_IN');
  for (const r of staying.slice(0, 6)) {
    const row = departures.getByTestId('event-row').filter({ hasText: r.confirmationNumber });
    await expect(row.getByRole('link', { name: 'Выселить' })).toHaveAttribute(
      'href',
      `/reservations/${r.confirmationNumber}#booking-actions`,
    );
  }
  const gone = d.departures.filter((r) => r.status === 'CHECKED_OUT').length;
  if (gone) await expect(departures).toContainText(`уже выехали: ${gone}`);
  await expect(arrivals.getByRole('link', { name: /Все заезды дня/ })).toHaveAttribute(
    'href',
    `/reservations?arrival=${d.date}`,
  );
});

test('номерной фонд и уборка: числа шахматки дня, неисправности — блокировки ремонта', async ({ page }) => {
  const d = await day(page);
  const board: Board = await (
    await page.request.get(`${fixture}/chessboard?from=${d.date}&to=${d.date}`, asClient)
  ).json();
  const s = board.summary[d.date]!;
  await page.goto('/today');
  const fund = page.getByRole('region', { name: 'Номерной фонд' });
  await expect(fund.getByTestId('fund-occupied')).toHaveText(String(s.occupied));
  await expect(fund.getByTestId('fund-free')).toHaveText(String(s.free));
  await expect(fund.getByTestId('fund-blocked')).toHaveText(String(s.blocked));
  // занятость по категориям одной строкой: «Имя занято/всего»
  const first = board.rows[0]!.unit;
  const cat = board.byCategory[d.date]![first.accommodationTypeCode]!;
  await expect(fund.getByTestId('fund-categories')).toContainText(
    `${first.accommodationTypeName} ${cat.occupied}/${cat.units}`,
  );

  const count = (status: string) =>
    board.rows.filter((r) => r.unit.housekeepingStatus === status).length;
  const care = page.getByRole('region', { name: 'Уборка и неисправности' });
  await expect(care.getByTestId('housekeeping-dirty')).toHaveText(String(count('DIRTY')));
  await expect(care.getByTestId('housekeeping-clean')).toHaveText(String(count('CLEAN')));
  await expect(care.getByTestId('housekeeping-inspected')).toHaveText(String(count('INSPECTED')));
  const broken = board.rows.filter((r) =>
    ['MAINTENANCE', 'OUT_OF_ORDER'].includes(r.cells[0]?.blockType ?? ''),
  ).length;
  await expect(care.getByTestId('repair-count')).toHaveText(String(broken));
});

test('уборка — только на сегодня: на другой день число «не готово» не выдумывается', async ({ page }) => {
  const d = await day(page);
  const tomorrow = new Date(Date.parse(`${d.date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  await page.goto(`/today?date=${tomorrow}`);
  const care = page.getByRole('region', { name: 'Уборка и неисправности' });
  await expect(care).toContainText('уборка — только на сегодня');
  await expect(care.getByTestId('housekeeping-dirty')).toHaveCount(0);
});

test('деньги сегодня: числа отчёта за день, «к оплате» — то же, что плитка; сравнение — владельцу', async ({
  page,
  request,
}) => {
  const d = await day(page);
  const report = await (
    await page.request.get(`${fixture}/finance/report?from=${d.date}&to=${d.date}`, asClient)
  ).json();
  await signIn(page);
  await page.goto('/today');
  const money = page.getByRole('region', { name: 'Деньги сегодня' });
  expect(digits((await money.getByTestId('money-charged').textContent()) ?? '')).toBe(
    tenge(report.chargedMinor),
  );
  expect(digits((await money.getByTestId('money-paid').textContent()) ?? '')).toBe(
    tenge(report.paidMinor),
  );
  expect(digits((await money.getByTestId('money-refunded').textContent()) ?? '')).toBe(
    tenge(report.refundedMinor),
  );
  expect(digits((await money.getByTestId('money-debt').textContent()) ?? '')).toBe(
    tenge(d.debtMinor),
  );
  await expect(money.getByRole('link', { name: 'Финансы' })).toHaveAttribute(
    'href',
    `/finance?from=${d.date}&to=${d.date}`,
  );
  await expect(money.getByTestId('money-compare')).toContainText('вчера');

  await request.post(`${fixture}/__test/control`, { data: { role: 'STAFF' } });
  await page.goto('/today');
  await expect(page.getByRole('region', { name: 'Деньги сегодня' }).getByTestId('money-paid')).toBeVisible();
  await expect(page.getByTestId('money-compare')).toHaveCount(0);
});

test('системы: Channex, продавец и сторож одной строкой каждый; сайта как данных нет', async ({ page }) => {
  await page.goto('/today');
  const systems = page.getByRole('region', { name: 'Системы' });
  await expect(systems.getByTestId('systems-channex')).toContainText('очередь 0');
  await expect(systems.getByTestId('systems-seller')).toBeVisible();
  // у подставного сторожа проверки копий нет среди проверок — так и сказано, без выдумки
  await expect(systems.getByTestId('systems-guard')).toContainText('проверка копий не настроена');
  await expect(systems.getByTestId('systems-guard')).toContainText('открытых инцидентов');
  await expect(systems).not.toContainText('Сайт');
});

test('сбой отчёта денег и сторожа: блок говорит о сбое, остальная Главная на месте', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/finance/report' } });
  await page.goto('/today');
  await expect(page.getByTestId('money-error')).toBeVisible();
  await expect(page.getByTestId('c-arrivals')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Заезды' })).toBeVisible();

  await request.post(`${fixture}/__test/reset`);
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/guard/status' } });
  await page.goto('/today');
  await expect(page.getByRole('region', { name: 'Системы' }).getByTestId('systems-channex')).toBeVisible();
  await expect(page.getByTestId('systems-guard')).toHaveCount(0);
});

/**
 * Снимки для визуального STOP после A2 (план §7): светлая и тёмная 1440, телефон 390, светлый и тёмный.
 * Высокое окно вместо склейки страницы: закреплённые меню и шапка на склейке «плывут» посреди снимка.
 * Данные — подставного API; на реальных данных Luxx снимает владелец на своём стенде (ADR-018).
 */
test('снимки Главной после A2', async ({ page }) => {
  const dir = 'reports/today-a2-2026-09-28';
  await signIn(page);
  for (const width of [1440, 390]) {
    for (const theme of ['light', 'dark'] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto('/today');
      const systems = page.getByRole('region', { name: 'Системы' });
      await expect(systems.getByTestId('systems-guard')).toBeVisible();
      await expect(page.getByTestId('money-paid')).toBeVisible();
      // окно ровно в высоту страницы: без пустого хвоста и без склейки
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.setViewportSize({ width, height });
      await page.screenshot({ path: `${dir}/today-${width}-${theme}.png` });
      if (width === 390) {
        // на телефоне страница длинная: блоки A2 отдельным снимком в натуральную величину
        const top = (await page.getByRole('region', { name: 'Заезды' }).boundingBox())!.y - 8;
        const box = (await systems.boundingBox())!;
        await page.screenshot({
          path: `${dir}/today-390-${theme}-a2.png`,
          clip: { x: 0, y: top, width, height: box.y + box.height + 8 - top },
        });
      }
    }
  }
});
