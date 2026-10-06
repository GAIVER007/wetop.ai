import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API, expect, test } from './fixtures';

/**
 * Страница `/guests/birthdays` использует уже хранимую дату рождения гостя. Календарь не показывает
 * этот показатель; подробности остаются на отдельной странице.
 */
const API = FIXTURE_API;
const H = { 'x-wetop-test-client': '1' };

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`, { headers: H });
});

test('календарь исключает дни рождения, отдельная страница раскрывает детали', async ({
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
  // дней рождения в сводке календаря нет (владелец 06.10: «лишнее убери»), страница живёт отдельно
  await expect(panel.getByTestId('day-birthdays')).toHaveCount(0);
  await expect(panel.getByText('Дни рождения')).toHaveCount(0);
  const panelBox = (await panel.boundingBox())!;
  const navBox = (await page.locator('.board-date-nav').boundingBox())!;
  expect(panelBox.x + panelBox.width <= navBox.x || panelBox.y + panelBox.height <= navBox.y).toBe(
    true,
  );
  await page.goto('/guests/birthdays');
  await expect(page).toHaveURL(/\/guests\/birthdays$/);
  const todaySection = page.getByRole('region', { name: 'Сегодня' });
  await expect(todaySection.getByRole('link', { name: 'Гость Тестовый' })).toHaveAttribute(
    'href',
    '/guests/ui-guest',
  );
  await expect(todaySection.getByText(/^\d+ (год|года|лет)$/)).toBeVisible();
  for (const theme of ['light', 'dark'] as const) {
    // без анимации смены темы: иначе axe ловит цвета посреди перехода (фон между светлым и тёмным)
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(axe.violations).toEqual([]);
  }
});

test('нет дат рождения: отдельная страница говорит, что в неделю пусто', async ({ page }) => {
  await page.goto('/chessboard');
  const panel = page.getByRole('group', { name: 'Сегодня на объекте' });
  await expect(panel.getByText('Дни рождения')).toHaveCount(0);
  await expect(panel.getByTestId('day-birthdays')).toHaveCount(0);
  await page.goto('/guests/birthdays');
  await expect(page.getByText('В ближайшую неделю дней рождения нет')).toBeVisible();
});
