import { expect, test } from '@playwright/test';
import { FIXTURE_API } from './fixtures';

/**
 * Компьютер: страница в один экран (поручение владельца 03.10 «максимально удобно и компактно,
 * без лишнего пустого пространства, без лишних скролов, чётко на одной странице по возможности»).
 *
 * Замер на 1440×900 до правок: «Свободные места» выходили за экран на 285 px, «Брони» на 203,
 * «Аналитика» на 147, «Гости» на 118, «Номерной фонд» на 96, «Отчёты» на 41. Приём тот же, что у
 * календаря: страница занимает экран, а длинный список прокручивается внутри себя, поэтому
 * заголовок, отборы и итог остаются на месте. Плюс низ страницы с 48 px до 24 и отступ под
 * заголовком с 24 до 16.
 *
 * Что намеренно прокручивается и в этот список не входит: «Отчёты» на 1280 (хаб из пятнадцати
 * карточек), «Настройки объекта» (длинная форма), карточки записей и журнал.
 */
const fixture = FIXTURE_API;
const LAPTOP = { width: 1440, height: 900 };

test.beforeEach(async ({ page, request }) => {
  await request.post(`${fixture}/__test/reset`);
  await page.setViewportSize(LAPTOP);
});

test('ноутбук 1440×900: рабочие экраны помещаются без прокрутки страницы', async ({ page }) => {
  test.slow(); // обход 14 разделов: на холодном `next dev` первая сборка каждого занимает секунды
  for (const route of [
    '/today',
    '/chessboard',
    '/reservations',
    '/guests',
    '/finance',
    '/finance?tab=cash',
    '/management/analytics',
    '/reports',
    '/rates',
    '/inventory',
    '/rooms/categories',
    '/rooms/availability',
    '/channels',
    '/team',
  ]) {
    await page.goto(route);
    await expect(page.getByRole('main')).toBeVisible();
    const over = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    );
    expect(over, `${route}: страница выше экрана на ${over} px`).toBeLessThanOrEqual(8);
  }
});

test('ноутбук: длинный список прокручивается внутри себя, отборы остаются на месте', async ({
  page,
}) => {
  // Если бы прокручивалась страница, строка отборов уезжала бы вверх вместе с таблицей
  await page.goto('/inventory');
  const scroller = page.locator('.inventory-content .table-scroll');
  await expect(scroller).toBeVisible();
  const toolbarBefore = (await page.locator('.inventory-toolbar').boundingBox())!.y;
  const scrolled = await scroller.evaluate((el) => {
    el.scrollTop = 200;
    return el.scrollTop;
  });
  expect(scrolled, 'таблица не прокручивается внутри себя').toBeGreaterThan(0);
  const toolbarAfter = (await page.locator('.inventory-toolbar').boundingBox())!.y;
  expect(toolbarAfter, 'строка отборов уехала вместе с таблицей').toBe(toolbarBefore);
});

test('ноутбук: под содержимым нет пустой полосы шире 32 px', async ({ page }) => {
  // 48 px нижнего отступа держали пустую полосу на каждом экране; у страниц во весь экран
  // этот отступ достался таблице
  for (const route of ['/finance', '/reports', '/channels', '/incidents']) {
    await page.goto(route);
    const pad = await page
      .locator('.page:visible')
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
    expect(pad, `${route}: нижний отступ ${pad} px`).toBeLessThanOrEqual(32);
  }
});
