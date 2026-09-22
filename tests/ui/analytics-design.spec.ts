import { expect, test } from '@playwright/test';

/**
 * «Аналитика сайта» и «Статистика» без каши (21.09.2026, продолжение правки).
 *
 * Найдено на стенде: подпись периода на обеих страницах разъезжалась по всей ширине — «Период», даты и
 * «, 7 дней, даты по Asia/Almaty» стояли в трёх разных концах строки, потому что `.directory-meta`
 * из `premium.css` — flex с `space-between` (для строки «счётчик + ссылка» в «Гостях»), а здесь абзац
 * с `<time>` внутри, и каждый кусок текста становился отдельным flex-элементом; четыре нижние таблицы
 * стояли в четыре колонки по ~270 px и обрезались («Сессий за пер»); пустые состояния говорили смене
 * кодом — `pms('event', 'search', …)`.
 */
const fixture = 'http://127.0.0.1:4311';

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('аналитика и статистика: подпись периода — одной строкой без разрывов', async ({ page }) => {
  const main = page.getByRole('main');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/analytics');
  const caption = main.getByTestId('an-period');
  await expect(caption).toContainText('даты по');
  // между двумя датами только « → »: расстояние в десятки пикселей, а не в сотни
  const gap = await caption.evaluate((el) => {
    const times = el.querySelectorAll('time');
    return times[1]!.getBoundingClientRect().left - times[0]!.getBoundingClientRect().right;
  });
  expect(gap, 'даты периода разъехались по ширине').toBeLessThanOrEqual(48);
  // «, 7 дней, даты по …» стоит сразу за датой, а не у правого края
  const tail = await caption.evaluate((el) => {
    const last = el.querySelectorAll('time')[1]!.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(el);
    return range.getBoundingClientRect().right - last.right;
  });
  expect(tail).toBeLessThanOrEqual(300);

  await page.goto('/management/statistics');
  const stats = main.getByTestId('statistics-meta');
  const lead = await stats.evaluate((el) => {
    const t = el.querySelector('time')!.getBoundingClientRect();
    return t.left - el.getBoundingClientRect().left;
  });
  expect(lead, 'дата в подписи статистики уехала от слов «Загрузка на»').toBeLessThanOrEqual(120);
});

test('аналитика: нижние таблицы не обрезаются, пустые состояния говорят словами и ведут к подключению', async ({
  page,
}) => {
  const main = page.getByRole('main');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/analytics');
  await expect(main.getByTestId('an-summary')).toBeVisible();
  // смене не показывают код: инструкция для разработчика живёт на странице подключения
  await expect(main.locator('code')).toHaveCount(0);
  const demand = main.getByTestId('an-demand-empty');
  await expect(demand).toContainText('Запросов нет');
  await expect(demand.getByRole('link', { name: /подключени/i })).toBeVisible();
  await expect(main.getByTestId('an-events-empty')).toContainText('Событий нет');
  // пустые «Устройства», «Браузеры», «ОС» видны целиком, без обрезки в прокрутку
  for (const id of ['an-devices', 'an-browsers', 'an-os']) {
    const empty = main.getByTestId(`${id}-empty`);
    await expect(empty).toBeVisible();
    const clipped = await empty.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(clipped, `${id}: текст обрезан`).toBeLessThanOrEqual(1);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
});
