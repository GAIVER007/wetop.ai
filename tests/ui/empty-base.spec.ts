import { expect, test } from './fixtures';

/**
 * База без броней, но с фондом — состояние боевой PMS после очистки 19.09.2026 (ADR-052) и до
 * первой живой смены: объект, 88 единиц, категории, тарифы и цены на месте, броней нет ни одной.
 * Смена увидит именно это, поэтому каждый экран обязан открыться и сказать, что броней нет,
 * а не показать ошибку, пустоту без объяснения или ноль вместо данных.
 */
const fixture = 'http://127.0.0.1:4311';
const ERROR_TEXT =
  /Не удалось загрузить|Проверьте подключение|Application error|Что-то пошло не так|Страница не найдена/;

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
  await request.post(`${fixture}/__test/control`, { data: { noBookings: true } });
});

const SCREENS: Array<{ route: string; title: RegExp; says?: RegExp }> = [
  { route: '/today', title: /Главная/ },
  { route: '/chessboard', title: /Календарь/ },
  { route: '/reservations', title: /Брони|Бронирован/, says: /нет|не найден/i },
  { route: '/guests', title: /Гости/, says: /нет|не найден/i },
  { route: '/rooms', title: /номер/i },
  { route: '/rooms/categories', title: /Категории/ },
  { route: '/rooms/availability', title: /Свободные места/ },
  { route: '/rates', title: /Тарифы/ },
  { route: '/finance', title: /Финансы/ },
  { route: '/management/analytics', title: /Аналитика/, says: /Недостаточно данных/ },
  { route: '/management/analytics/occupancy', title: /Аналитика/ },
  { route: '/journal', title: /Журнал/ },
  { route: '/incidents', title: /Неисправност/ },
  { route: '/channels', title: /Подключени|Channex|Каналы/ },
  { route: '/connections', title: /Подключения/ },
  { route: '/website', title: /Сайт и онлайн-бронирование/ },
  { route: '/website/analytics', title: /Сайт и онлайн-бронирование/ },
  { route: '/hotel-settings', title: /Объект|Настройки|гостиниц/i },
  { route: '/channels/mapping', title: /Сопоставление/ },
];

for (const screen of SCREENS) {
  test(`пустая база: ${screen.route} открывается и объясняет пустоту`, async ({ page }) => {
    await page.goto(screen.route);
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 1 })).toContainText(screen.title);
    const text = (await main.innerText()).replace(/\s+/g, ' ');
    expect(ERROR_TEXT.exec(text)?.[0] ?? '').toBe('');
    if (screen.says) expect(text).toMatch(screen.says);
  });
}

test('пустая база: шахматка показывает все места свободными, а не пустую сетку', async ({
  page,
}) => {
  await page.goto('/chessboard');
  const main = page.getByRole('main');
  await expect(main.getByTestId('unit-row').first()).toBeVisible();
  await expect(main.getByTestId('stay-cell')).toHaveCount(0);
  // «без ячейки» при пустой базе — блока нет вовсе (ТЗ «Шахматка v2» §11)
  await expect(main.getByTestId('unassigned-stays')).toHaveCount(0);
});

test('пустая база: главная говорит про ноль словами, а не пустыми плитками', async ({ page }) => {
  await page.goto('/today');
  const main = page.getByRole('main');
  // Главная владельца (30.09–01.10.2026): заезды и выезды дня одной плиткой «Заезды / выезды»
  await expect(main.getByTestId('owner-movements')).toContainText('0 / 0');
  const text = (await main.innerText()).replace(/\s+/g, ' ');
  expect(text).toMatch(/Заезд|Выезд|Проживают/);
});
