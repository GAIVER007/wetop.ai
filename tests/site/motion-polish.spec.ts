import { expect, test } from '@playwright/test';

/*
 * Полировка движения и типографики по навыку apple-design (.claude/skills/apple-design, 22.10.2026):
 *   1. отклик на само нажатие: кнопка прижимается до отпускания, а не после;
 *   2. вопросы (details) раскрываются плавно и прерываемо: переход стартует с текущего значения,
 *      повторный щелчок разворачивает движение, не дожидаясь конца;
 *   3. кромка шапки появляется только когда под ней прокручен контент (scroll edge вместо жёсткой линии);
 *   4. стрелка «Подробнее» движется transform-ом, а не layout-свойством gap;
 *   5. абзацы переносятся аккуратно (text-wrap: pretty).
 * При reduced motion страница остаётся понятной: ответы открываются мгновенно, элементы спокойны.
 */

const PAGE = '/for/hostels/';

/** Горизонтальный масштаб из computed matrix(a, b, c, d, e, f); у 'none' масштаб 1. */
const scaleOf = (transform: string) => {
  const m = /^matrix\((-?[\d.]+),/.exec(transform);
  return m ? Number(m[1]) : 1;
};

test('кнопка отвечает на само нажатие: прижимается до отпускания', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(PAGE);
  // Первая кнопка страницы целиком лежит в свёрнутом мобильном меню: берём видимую из контента
  const btn = page.locator('main .btn--primary').first();
  // Входная анимация героя двигает кнопку сразу после наведения: дождаться конечных анимаций
  // (бесконечную scroll-анимацию кромки шапки не ждать, она не завершается)
  await btn.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.timeline?.constructor?.name !== 'ScrollTimeline')
        .map((a) => a.finished.catch(() => null)),
    ),
  );
  await btn.hover();
  await page.mouse.down();
  await expect
    .poll(async () => scaleOf(await btn.evaluate((el) => getComputedStyle(el).transform)), {
      timeout: 2_000,
    })
    .toBeLessThan(0.995);
  // Уйти с кнопки до отпускания: жест отменяется, окно регистрации не открывается
  await page.mouse.move(0, 0);
  await page.mouse.up();
});

test('вопрос раскрывается плавно и прерываемо, при reduced motion мгновенно', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(PAGE);
  const item = page.locator('.faq details').first();
  await item.scrollIntoViewIfNeeded();
  const durations = await item.evaluate(
    (el) => getComputedStyle(el, '::details-content').transitionDuration,
  );
  expect(durations, 'у содержимого details нет перехода').not.toBe('0s');
  const summary = item.locator('summary');
  await summary.click();
  await expect(item.locator('p')).toBeVisible();
  // Прерываемость: закрытие сразу после открытия, не дожидаясь конца перехода
  await summary.click();
  await expect(item.locator('p')).toBeHidden();

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await item.evaluate(
    (el) => getComputedStyle(el, '::details-content').transitionDuration,
  );
  expect(
    reduced.split(',').every((d) => d.trim() === '0s'),
    `при reduced motion переход остался: ${reduced}`,
  ).toBe(true);
  await summary.click();
  await expect(item.locator('p')).toBeVisible();
});

test('кромка шапки появляется только над прокрученным контентом', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(PAGE);
  const supported = await page.evaluate(() => CSS.supports('animation-timeline: scroll()'));
  test.skip(!supported, 'браузер без scroll-driven animations');
  const header = page.locator('.site-header');
  const shadow = () => header.evaluate((el) => getComputedStyle(el).boxShadow);
  // На нулевой прокрутке тень вычисляется прозрачной (интерполяция от none): запоминаем и сверяем
  const atTop = await shadow();
  expect(atTop).toMatch(/^(none|rgba\(0, 0, 0, 0\))/);
  await page.mouse.wheel(0, 600);
  await expect.poll(shadow).not.toBe(atTop);
  await page.mouse.wheel(0, -600);
  await expect.poll(shadow).toBe(atTop);
});

test('стрелка «Подробнее» подсказывает направление transform-ом, без перераскладки', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(PAGE);
  const card = page.locator('.card', { has: page.locator('.link-arrow') }).first();
  await card.scrollIntoViewIfNeeded();
  const transition = await card
    .locator('.link-arrow')
    .evaluate((el) => getComputedStyle(el).transitionProperty);
  expect(transition, 'gap анимирует layout на каждом кадре').not.toContain('gap');
  await card.hover();
  await expect
    .poll(() => card.locator('.link-arrow .icon').evaluate((el) => getComputedStyle(el).transform))
    .not.toBe('none');
});

test('абзацы переносятся аккуратно: text-wrap pretty', async ({ page }) => {
  await page.goto(PAGE);
  const wrap = await page
    .locator('main p')
    .first()
    .evaluate((el) => getComputedStyle(el).textWrap);
  expect(wrap).toBe('pretty');
});
