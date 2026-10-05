import { mkdirSync } from 'node:fs';
import { FIXTURE_API, expect, test } from './fixtures';

const add = (date: string, nights: number) => {
  const day = new Date(`${date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + nights);
  return day.toISOString().slice(0, 10);
};

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

for (const width of [360, 390, 430]) {
  test(`телефон ${width}: читаемые даты, прокрутка и бронь на несколько ночей`, async ({
    browser,
    request,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    const stay = await (
      await request.get(`${FIXTURE_API}/reservations/20260913-TEST1`, {
        headers: { 'x-wetop-test-client': '1' },
      })
    ).json();
    const from = stay.arrivalDate as string;
    await page.goto(`/chessboard?from=${from}&to=${add(from, 6)}`);
    await page.getByLabel('Поиск в календаре').fill('R07');
    const wrap = page.locator('.board-wrap');
    expect(await wrap.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeGreaterThan(300);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await wrap.scrollIntoViewIfNeeded();
    const unit = page.locator('[data-unit-code="R07"] .board__unit');
    await page.evaluate(() => document.fonts.ready);
    await unit.scrollIntoViewIfNeeded();
    const before = (await unit.boundingBox())!.x;
    // Касания попадают в видимую строку, а не в зависящий от шрифтов отступ сетки.
    const rowBox = (await unit.boundingBox())!;
    const startX = width - 30;
    const touchY = Math.round(rowBox.y + rowBox.height / 2);
    expect(touchY).toBeGreaterThan(0);
    expect(touchY).toBeLessThan(844);
    expect(
      await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.board-wrap'), {
        x: startX,
        y: touchY,
      }),
    ).toBe(true);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: startX, y: touchY }],
    });
    for (let offset = 10; offset <= 230; offset += 10) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: startX - offset, y: touchY }],
      });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => wrap.evaluate((el) => el.scrollLeft)).toBeGreaterThan(100);
    expect((await unit.boundingBox())!.x).toBeCloseTo(before, 0);
    await expect(page.getByTestId('free-menu')).toBeHidden();
    await wrap.evaluate((el) => {
      el.scrollLeft = 0;
    });
    await page.locator(`[data-unit-code="R07"] td[data-date="${from}"] .board__free`).tap();
    const menu = page.getByTestId('free-menu');
    await expect(menu).toBeVisible();
    expect((await menu.boundingBox())!.width).toBeGreaterThan(width - 30);
    await menu.getByLabel('Период проживания').selectOption('2');
    await expect(menu.getByRole('link', { name: 'Создать бронь', exact: true })).toHaveAttribute(
      'href',
      `/reservations/new?arrival=${from}&departure=${add(from, 3)}&unit=R07`,
    );
    mkdirSync('reports/calendar-mobile-2026-10-05', { recursive: true });
    await page.screenshot({
      path: `reports/calendar-mobile-2026-10-05/light-${width}-booking.png`,
    });
    await menu.getByRole('link', { name: 'Создать бронь', exact: true }).tap();
    await expect(page).toHaveURL(
      new RegExp(`/reservations/new\\?arrival=${from}&departure=${add(from, 3)}&unit=R07`),
    );
    await context.close();
  });
}

test('мобильный период останавливается перед занятой ночью', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const stay = await (
    await request.get(`${FIXTURE_API}/reservations/20260913-TEST1`, {
      headers: { 'x-wetop-test-client': '1' },
    })
  ).json();
  const from = add(stay.arrivalDate as string, -1);
  await page.goto(`/chessboard?from=${from}&to=${add(from, 6)}`);
  await page.getByLabel('Поиск в календаре').fill('R02');
  await page.locator(`[data-unit-code="R02"] td[data-date="${from}"] .board__free`).click();
  const menu = page.getByTestId('free-menu');
  await expect(menu.getByLabel('Период проживания')).toBeVisible();
  await expect(menu.getByLabel('Период проживания').locator('option')).toHaveCount(1);
  await expect(menu.getByRole('link', { name: 'Новая бронь', exact: true })).toHaveAttribute(
    'href',
    `/reservations/new?arrival=${from}&departure=${add(from, 1)}&unit=R02`,
  );
});

for (const theme of ['light', 'dark'] as const) {
  test(`телефон ${theme}: карточка брони, фильтры и длинный календарь`, async ({
    browser,
    request,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      colorScheme: theme,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const stay = await (
      await request.get(`${FIXTURE_API}/reservations/20260913-TEST1`, {
        headers: { 'x-wetop-test-client': '1' },
      })
    ).json();
    const from = stay.arrivalDate as string;
    await page.goto(`/chessboard?from=${from}&to=${add(from, 13)}`);
    await page.getByLabel('Поиск в календаре').fill('R02');
    const plate = page.locator('[data-unit-code="R02"] .board__stay').first();
    await plate.tap();
    const preview = page.getByTestId('stay-preview');
    await expect(preview).toBeVisible();
    expect((await preview.boundingBox())!.width).toBeGreaterThan(360);
    await expect(preview.getByRole('link', { name: 'Открыть бронь', exact: true })).toBeVisible();
    await page.screenshot({ path: `reports/calendar-mobile-2026-10-05/${theme}-390-preview.png` });
    await preview.getByRole('button', { name: 'Закрыть предпросмотр', exact: true }).tap();
    await page.getByLabel('Поиск в календаре').fill('');
    await page.getByRole('button', { name: 'Фильтры', exact: true }).tap();
    const filters = page.getByRole('dialog', { name: 'Фильтры календаря' });
    await expect(filters).toBeVisible();
    await filters.getByRole('button', { name: 'Применить', exact: true }).tap();
    const wrap = page.locator('.board-wrap');
    expect(await wrap.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeGreaterThan(1000);
    await page.screenshot({ path: `reports/calendar-mobile-2026-10-05/${theme}-390-grid.png` });
    await wrap.scrollIntoViewIfNeeded();
    await wrap.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(page.getByTestId('unit-row').last()).toBeInViewport();
    await context.close();
  });
}

test('форма брони на телефоне: крупные поля, сохранённые даты и доступная кнопка', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/reservations/new?arrival=2026-11-10&departure=2026-11-13&unit=R07');
  const form = page.locator('.booking-create');
  await expect(form.locator('[name="arrivalDate"]')).toHaveValue('2026-11-10');
  await expect(form.locator('[name="departureDate"]')).toHaveValue('2026-11-13');
  await expect(form.locator('[name="unitCode"]')).toHaveValue('R07');
  for (const control of await form
    .locator('input:not([type="hidden"]):visible, select:visible')
    .all()) {
    if ((await control.getAttribute('type')) === 'checkbox') continue;
    expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(
      await control.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ).toBeGreaterThanOrEqual(16);
  }
  await page.setViewportSize({ width: 390, height: 480 });
  const submit = form.getByRole('button', { name: 'Создать бронь', exact: true });
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
});

for (const width of [360, 390, 430]) {
  test(`статистика ${width}: шесть показателей перед календарём и вертикальная прокрутка`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/chessboard');
    const stats = page.getByRole('group', { name: 'Сегодня на объекте' });
    await expect(stats).toBeVisible();
    for (const id of [
      'arrivals',
      'departures',
      'tasks',
      'free',
      'units',
      'occupied',
      'occupancy',
    ]) {
      await expect(stats.getByTestId(`day-${id}`)).toBeVisible();
    }
    const day = await (
      await request.get(`${FIXTURE_API}/desk/today`, { headers: { 'x-wetop-test-client': '1' } })
    ).json();
    await expect(stats.getByTestId('day-arrivals')).toHaveText(String(day.counts.arrivals));
    await expect(stats.getByText('Проживания')).toHaveCount(0);
    await expect(stats.getByText('Дни рождения')).toHaveCount(0);
    const grid = page.locator('.board-wrap');
    expect((await stats.boundingBox())!.y).toBeLessThan((await grid.boundingBox())!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await grid.scrollIntoViewIfNeeded();
    await expect(grid).toBeInViewport();
    await page.screenshot({
      path: `reports/calendar-mobile-2026-10-05/statistics-${width}-grid.png`,
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `reports/calendar-mobile-2026-10-05/statistics-${width}-top.png`,
    });
  });
}

test('мобильная панель меняет заезд без закрытия и показывает выезд', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const stay = await (
    await request.get(`${FIXTURE_API}/reservations/20260913-TEST1`, {
      headers: { 'x-wetop-test-client': '1' },
    })
  ).json();
  const from = stay.arrivalDate as string;
  await page.goto(`/chessboard?from=${from}&to=${add(from, 13)}`);
  await page.getByLabel('Поиск в календаре').fill('R07');
  await page.locator(`[data-unit-code="R07"] td[data-date="${from}"] .board__free`).click();
  const menu = page.getByTestId('free-menu');
  await menu.getByLabel('Заезд', { exact: true }).selectOption(add(from, 1));
  await menu.getByLabel('Период проживания').selectOption('2');
  await expect(menu.getByTestId('free-menu-departure')).toHaveAttribute('data-date', add(from, 4));
  await expect(menu.getByRole('link', { name: 'Создать бронь', exact: true })).toHaveAttribute(
    'href',
    `/reservations/new?arrival=${add(from, 1)}&departure=${add(from, 4)}&unit=R07`,
  );
});
test('календарь возвращает обе позиции после полной карточки и сбрасывает их по Сегодня', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/chessboard');
  const wrap = page.locator('.board-wrap');
  await wrap.scrollIntoViewIfNeeded();
  await wrap.evaluate((el) => {
    el.scrollLeft = 220;
    el.scrollTop = 280;
  });
  const position = await wrap.evaluate((el) => ({ x: el.scrollLeft, y: el.scrollTop }));
  await page.goto('/reservations/20260913-TEST1');
  await page.goBack();
  await expect.poll(() => wrap.evaluate((el) => el.scrollLeft)).toBeCloseTo(position.x, 0);
  await expect.poll(() => wrap.evaluate((el) => el.scrollTop)).toBeCloseTo(position.y, 0);
  await page.getByRole('link', { name: 'Сегодня', exact: true }).click();
  await expect.poll(() => wrap.evaluate((el) => el.scrollLeft)).toBe(0);
});

test('мобильная форма: ввод гостя на низком экране не перекрыт действиями', async ({
  page,
  request,
}) => {
  await request.post(`${FIXTURE_API}/__test/control`, { data: { piiStorage: 'real' } });
  await page.setViewportSize({ width: 360, height: 480 });
  await page.goto('/reservations/new?arrival=2026-11-10&departure=2026-11-13&unit=R07');
  const name = page.locator('[name="firstName"]');
  await name.fill('Проверочный');
  await name.scrollIntoViewIfNeeded();
  await expect(name).toBeFocused();
  await expect(name).toBeInViewport({ ratio: 1 });
  expect(
    await page.locator('.booking-footer').evaluate((el) => getComputedStyle(el).position),
  ).toBe('static');
  await page.locator('[name="lastName"]').fill('Мобильный');
  await expect(page.locator('[name="phone"]')).toHaveAttribute('type', 'tel');
  const submit = page.getByRole('button', { name: 'Создать бронь', exact: true });
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeInViewport({ ratio: 1 });
});

for (const theme of ['light', 'dark'] as const) {
  test(`телефон ${theme}: длинное имя и бронь на 28 ночей`, async ({ page, request }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.emulateMedia({ colorScheme: theme });
    const result = await request.post(`${FIXTURE_API}/reservations`, {
      headers: { 'x-wetop-test-client': '1' },
      data: {
        arrivalDate: '2026-11-01',
        departureDate: '2026-11-29',
        source: 'DESK',
        guest: {
          firstName: 'ПроверочноеОченьДлинноеИмя',
          lastName: 'ДлиннаяТестоваяФамилияМобильногоГостя',
        },
        items: [{ accommodationTypeCode: 'ROOM', quantity: 1, adults: 1, unitCode: 'R07' }],
      },
    });
    expect(result.ok()).toBe(true);
    await page.goto('/chessboard?from=2026-11-01&to=2026-11-30');
    await page.getByLabel('Поиск в календаре').fill('R07');
    await page.locator('[data-unit-code="R07"] .board__stay').first().click();
    const preview = page.getByTestId('stay-preview');
    await expect(preview.getByTestId('preview-dates')).toContainText('28 ночей');
    await expect(preview.getByRole('link', { name: 'Открыть гостя', exact: true })).toBeVisible();
    expect(await preview.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    const guest = preview.getByTestId('preview-guest');
    expect((await guest.boundingBox())!.width).toBeLessThan(320);
    const actions = preview.getByRole('link', { name: 'Изменить даты', exact: true });
    await actions.scrollIntoViewIfNeeded();
    await expect(actions).toBeInViewport({ ratio: 0.99 });
    await page.screenshot({ path: `reports/calendar-mobile-2026-10-05/${theme}-long-name.png` });
  });
}

test('телефон возвращает поиск номера и выбранный вид мест после карточки', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/chessboard');
  const search = page.getByLabel('Поиск в календаре');
  await search.fill('R02');
  await page.getByRole('button', { name: 'Фильтры', exact: true }).click();
  const filters = page.getByRole('dialog', { name: 'Фильтры календаря' });
  await filters.getByRole('button', { name: 'Номера', exact: true }).click();
  await filters.getByRole('button', { name: 'Применить', exact: true }).click();
  await page.locator('.board-wrap').scrollIntoViewIfNeeded();
  await page.goto('/reservations/20260913-TEST1');
  await page.goBack();
  await expect(search).toHaveValue('R02');
  await expect(
    page.getByRole('button', { name: 'Убрать условие: Номера', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('unit-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
  await page.goto('/reservations/20260913-TEST1');
  await page.goBack();
  await expect(search).toHaveValue('');
  await expect(
    page.getByRole('button', { name: 'Убрать условие: Номера', exact: true }),
  ).toHaveCount(0);
});
