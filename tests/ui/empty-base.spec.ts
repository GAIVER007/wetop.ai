import { expect, test } from '@playwright/test';

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
  { route: '/chessboard', title: /Шахматка/ },
  { route: '/reservations', title: /Брони|Бронирован/, says: /нет|не найден/i },
  { route: '/guests', title: /Гости/, says: /нет|не найден/i },
  { route: '/rooms', title: /номер/i },
  { route: '/rooms/categories', title: /Категории/ },
  { route: '/rooms/availability', title: /Доступность/ },
  { route: '/rates', title: /Цены/ },
  { route: '/finance', title: /Деньги/ },
  { route: '/management/statistics', title: /Статистика/ },
  { route: '/journal', title: /Журнал/ },
  { route: '/incidents', title: /Неисправност/ },
  { route: '/channels', title: /Подключени|Channex|Каналы/ },
  { route: '/connections', title: /Интеграции/ },
  { route: '/analytics', title: /Аналитика/ },
  { route: '/hotel-settings', title: /Объект|Настройки|гостиниц/i },
  { route: '/channel-manager', title: /Менеджер каналов|Каналы/ },
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
  // «без ячейки» при пустой базе — ноль, и это короткая строка, а не предупреждение
  await expect(main.getByTestId('unassigned-stays')).toHaveAttribute('data-count', '0');
});

test('пустая база: главная говорит про ноль словами, а не пустыми плитками', async ({ page }) => {
  await page.goto('/today');
  const main = page.getByRole('main');
  await expect(main.getByTestId('c-arrivals')).toContainText('0');
  const text = (await main.innerText()).replace(/\s+/g, ' ');
  expect(text).toMatch(/Заезд|Выезд|Проживают/);
});
