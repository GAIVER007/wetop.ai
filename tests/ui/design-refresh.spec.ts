import { expect, test, FIXTURE_API } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

test('главная: новая бронь и полоса стойки доступны на первом экране', async ({ page }) => {
  // A1 (ADR-103): операционная часть — первый экран; резюме-дубля внимания сверху больше нет
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width > 600 ? 1000 : 844 });
    await page.goto('/today');
    const create = page.getByRole('main').getByRole('link', { name: 'Новая бронь', exact: true });
    await expect(create).toBeInViewport({ ratio: 1 });
    const strip = page.getByRole('region', { name: 'Сегодня на стойке' });
    await expect(strip).toBeInViewport();
    // Блок задач стоит сразу под полосой и приходит тем же потоковым куском
    const heading = page.getByRole('heading', { name: 'Требуют внимания', exact: true });
    await expect(heading).toBeAttached();
    if (width === 1440) await expect(heading).toBeInViewport();
  }
});

test('полоса дня на телефоне и период «Аналитики»: подписанные поля и цели не меньше 44 px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/today');
  for (const control of [
    page.getByLabel('День стойки: дата'),
    page.getByTestId('day-form').getByRole('button', { name: 'Показать' }),
    page
      .getByRole('navigation', { name: 'День стойки' })
      .getByRole('link', { name: 'Сегодня', exact: true }),
  ]) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
  // «Показатели за период» с AN2 — «Аналитика» (ADR-114): обе вкладки, свой период — в панели «Период»
  for (const route of ['/management/analytics', '/management/analytics/occupancy']) {
    await page.goto(route);
    const main = page.getByRole('main');
    await main.locator('.pa-range > summary').click();
    const controls = [
      main.getByLabel('Период: с'),
      main.getByLabel('Период: по'),
      main.getByTestId('pa-range-form').getByRole('button', { name: 'Применить' }),
      main.locator('.pa-range > summary'),
      main.getByRole('navigation', { name: 'Период' }).getByRole('link', { name: 'Сегодня' }),
      main.getByTestId('pa-fund').getByRole('link', { name: 'Койки' }),
      main.getByTestId('pa-compare-toggle'),
    ];
    if (route.endsWith('occupancy'))
      controls.push(main.getByTestId('pa-day-prev'), main.getByTestId('pa-day-next'));
    for (const control of controls) {
      const box = await control.boundingBox();
      expect(box, `${route}: ${control}`).not.toBeNull();
      expect(box!.height, `${route}: ${control}`).toBeGreaterThanOrEqual(44);
      expect(box!.width, `${route}: ${control}`).toBeGreaterThanOrEqual(44);
    }
  }
});

test('главная живёт одним днём, месячные показатели — на своём экране', async ({ page }) => {
  // день стойки задаёт ?date=, ?period= Главная больше не читает (A1, ADR-103)
  await page.goto('/today?period=month&date=2026-09-17');
  await expect(
    page.getByRole('region', { name: 'Сегодня на стойке' }).locator('.desk-strip__date'),
  ).toHaveAttribute('datetime', '2026-09-17');
  await expect(page.getByTestId('period-caption')).toHaveCount(0);
  // месячные показатели — «Аналитика → Обзор» (ADR-114); оплаты — в «Оплатах», ADR и RevPAR — у типа фонда
  await page.goto('/management/analytics?period=month');
  await expect(page.getByTestId('pa-period')).toContainText(/(28|29|30|31) д/);
  for (const id of ['occupancy', 'revenue', 'nights', 'bookings', 'cancelled', 'average']) {
    await expect(page.getByTestId(`pa-kpi-${id}`)).toBeVisible();
  }
  await page.goto('/management/analytics?period=month&fund=rooms');
  for (const id of ['adr', 'revpar']) await expect(page.getByTestId(`pa-kpi-${id}`)).toBeVisible();
});

for (const theme of ['light', 'dark'] as const) {
  for (const width of [1440, 390]) {
    test(`редизайн: доступность и снимки главной и компонентов, ${theme}, ${width}`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      const directory = 'reports/design-refresh-2026-09-19/after';
      mkdirSync(directory, { recursive: true });
      for (const route of ['today', 'design-system']) {
        await page.goto(`/${route}`);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        const result = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(
          result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
        ).toEqual([]);
        const overflow = await page.evaluate(() => {
          const browser = globalThis as unknown as {
            innerWidth: number;
            document: { documentElement: { scrollWidth: number } };
          };
          return browser.document.documentElement.scrollWidth - browser.innerWidth;
        });
        expect(overflow).toBeLessThanOrEqual(1);
        if (route === 'today') {
          await page.screenshot({ path: `${directory}/today-${theme}-${width}.png` });
        } else {
          for (const component of ['button', 'input']) {
            const section = page
              .getByTestId(`kit-${theme}`)
              .locator(`[data-component="${component}"]`);
            await section.screenshot({
              path: `${directory}/${component}-${theme}-${width}.png`,
              // Снимаем компонент целиком: фиксированный каркас не должен перекрывать длинный снимок.
              style:
                '.workspace-header, .bottom-navigation, .skip-link { visibility: hidden !important; }',
            });
          }
        }
      }
    });
  }
}
