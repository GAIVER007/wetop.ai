import { FIXTURE_API, expect, test } from './fixtures';

/**
 * «Быстрый отчёт» гостиницы карточкой салона (владелец 31.10.2026: «сделай как под салоны», «Статусы оставляй»,
 * «без лишней инфы»): клиенты и брони, все статусы календаря, сумма броней, выручка, средний чек, наличные и безнал,
 * долг; без заездов, выездов и пояснения «Как считаются показатели».
 */
test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

test('отчёт гостиницы как у салона', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/chessboard');
  await page.getByRole('button', { name: 'Быстрый отчёт', exact: true }).click();
  const report = page.getByRole('dialog');
  await expect(report).toBeVisible();
  for (const text of ['Клиентов', 'Броней', 'Статусы', 'Подтверждённые', 'Проживают', 'Незаезды', 'Сумма броней', 'Выручка', 'Средний чек', 'Финансы:', 'Оплата наличными', 'Оплата безналом', 'Не оплачено по броням'])
    await expect(report.getByText(text, { exact: true }).first()).toBeVisible();
  for (const gone of ['Заездов', 'Выездов', 'Как считаются показатели', 'Лояльность и WETOP'])
    await expect(report.getByText(gone, { exact: true })).toHaveCount(0);
  await expect(report.locator('.reference-kpis')).not.toContainText('Нет данных');
  if (process.env.CABINET_SHOTS) await page.screenshot({ path: `${process.env.CABINET_SHOTS}/hotel-quick-report.png` });
  await report.getByRole('button', { name: 'Месяц', exact: true }).click();
  await expect(report.getByText('Сумма броней', { exact: true })).toBeVisible();
});
