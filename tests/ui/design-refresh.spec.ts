import { FIXTURE_API, expect, test } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

test('финансы: деньги на первом экране; главная без кнопок брони, внимание достижимо', async ({
  page,
}) => {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width > 600 ? 1000 : 844 });
    // «Финансы» (ADR-180): плитки денег первым экраном, кнопки брони нет
    await page.goto('/finance');
    await expect(page.getByRole('main').getByRole('link', { name: /Новая бронь/ })).toHaveCount(0);
    await expect(page.getByTestId('cash-period-income')).toBeInViewport();
    // «Главная» (/today): риски и «Все задачи» живут здесь
    await page.goto('/today');
    await expect(page.getByRole('main').getByRole('link', { name: /Новая бронь/ })).toHaveCount(0);
    const risks = page.getByTestId('owner-risks');
    await expect(risks).toBeAttached();
    const attention = page
      .getByTestId('owner-dashboard')
      .getByRole('button', { name: 'Все задачи', exact: true });
    await expect(attention).toBeAttached();
    await attention.scrollIntoViewIfNeeded();
    await expect(attention).toBeInViewport();
  }
});

test('период «Финансов» и «Аналитики» на телефоне: подписанные поля и цели не меньше 44 px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/finance');
  // период денег: даты «С / По» нижних отборов (ADR-180); в шапке свой контрол периода
  const filters = page.locator('#finance-filters');
  for (const control of [
    filters.getByLabel('Период: с', { exact: true }),
    filters.getByLabel('Период: по', { exact: true }),
    page.getByTestId('period-form').getByRole('button', { name: 'Показать', exact: true }),
    page
      .getByRole('navigation', { name: 'Готовые периоды' })
      .getByRole('link', { name: 'Сегодня', exact: true }),
  ]) {
    const box = await control.boundingBox();
    expect(box, `${control}`).not.toBeNull();
    expect(box!.height, `${control}`).toBeGreaterThanOrEqual(44);
    expect(box!.width, `${control}`).toBeGreaterThanOrEqual(44);
  }
  // «Обзор» выбирает только месяц (владелец 26.10.2026); «Загрузка» по дням со своим периодом
  for (const route of ['/management/analytics', '/management/analytics/occupancy']) {
    await page.goto(route);
    const main = page.getByRole('main');
    const month = route.endsWith('analytics');
    if (!month) await main.locator('.pa-range > summary').click();
    const controls = month
      ? [
          main.getByTestId('analytics-month-prev'),
          main.getByTestId('analytics-month-label'),
          main.getByTestId('pa-fund').getByRole('link', { name: 'Койки' }),
          main.getByTestId('pa-compare-toggle'),
        ]
      : [
          main.getByLabel('Период: с', { exact: true }),
          main.getByLabel('Период: по', { exact: true }),
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

test('финансы за выбранный период, риски за сегодня; месяц целиком в «Аналитике»', async ({
  page,
}) => {
  // from/to задают деньги; месяц по умолчанию виден в нижних отборах
  await page.goto('/finance');
  await expect(
    page
      .getByRole('navigation', { name: 'Готовые периоды' })
      .getByRole('link', { name: 'Месяц', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('period-caption')).toHaveCount(0);
  // полоса рисков и «Сегодня» всегда о сегодняшнем дне и живут на «Главной» (ADR-180)
  await page.goto('/today');
  await expect(page.getByRole('region', { name: 'Сегодня', exact: true })).toBeVisible();
  await expect(page.getByTestId('owner-risks')).toBeVisible();
  // месячные показатели в «Аналитике → Обзор» (ADR-114), оплаты в «Оплатах», ADR и RevPAR у типа фонда
  await page.goto('/management/analytics?period=month');
  await expect(page.getByTestId('pa-period')).toContainText(/(28|29|30|31) д/);
  for (const id of ['occupancy', 'revenue', 'bookings', 'cancelled'])
    await expect(page.getByTestId(`pa-kpi-${id}`)).toBeVisible();
  await page.locator('.pa-details > summary').click();
  for (const id of ['nights', 'average'])
    await expect(page.getByTestId(`pa-kpi-${id}`)).toBeVisible();
  await page.goto('/management/analytics?period=month&fund=rooms');
  await page.locator('.pa-details > summary').click();
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
      const directory = 'reports/finance-home-merge-2026-10-09/accessibility';
      mkdirSync(directory, { recursive: true });
      for (const route of ['finance', 'design-system']) {
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
        if (route === 'finance') {
          await page.screenshot({
            caret: 'initial',
            path: `${directory}/finance-${theme}-${width}.png`,
          });
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
