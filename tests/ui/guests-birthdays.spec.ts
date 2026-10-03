import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

/**
 * «Дни рождения» (Q-249 T0, образец Lite PMS): строка в панели «Сегодня» календаря и страница
 * `/guests/birthdays` из уже хранимой даты рождения гостя. Панель «Сегодня» стоит слева от
 * управления календарём (владелец 03.10: «календарь справа, остальное слева»).
 */
const API = process.env['UI_FIXTURE_API'] ?? 'http://127.0.0.1:4311';
const H = { 'x-wetop-test-client': '1' };

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`, { headers: H });
});

test('панель «Сегодня» слева, управление календарём справа; строка «Дни рождения»', async ({
  page,
  request,
}) => {
  // день рождения вымышленного гостя — сегодня по часам стенда
  const day = (await (await request.get(`${API}/desk/today`, { headers: H })).json()) as {
    date: string;
  };
  await request.patch(`${API}/guests/ui-guest`, {
    headers: H,
    data: { birthDate: `1990-${day.date.slice(5)}` },
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/chessboard');
  const panel = page.getByRole('group', { name: 'Сегодня на объекте' });
  const birthdays = panel.getByTestId('day-birthdays');
  await expect(birthdays).toHaveText('1');
  const panelBox = (await panel.boundingBox())!;
  const navBox = (await page.locator('.board-date-nav').boundingBox())!;
  expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(navBox.x);
  await panel.getByRole('link', { name: /Дни рождения/ }).click();
  await expect(page).toHaveURL(/\/guests\/birthdays$/);
  const todaySection = page.getByRole('region', { name: 'Сегодня' });
  await expect(todaySection.getByRole('link', { name: 'Гость Тестовый' })).toHaveAttribute(
    'href',
    '/guests/ui-guest',
  );
  await expect(todaySection.getByText(/^\d+ (год|года|лет)$/)).toBeVisible();
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(axe.violations).toEqual([]);
  }
});

test('нет дат рождения: строка «0», страница говорит, что в неделю пусто', async ({ page }) => {
  await page.goto('/chessboard');
  await expect(
    page.getByRole('group', { name: 'Сегодня на объекте' }).getByTestId('day-birthdays'),
  ).toHaveText('0');
  await page.goto('/guests/birthdays');
  await expect(page.getByText('В ближайшую неделю дней рождения нет')).toBeVisible();
});
