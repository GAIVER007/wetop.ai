import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

/**
 * Сторож правила фикстуры (разбор 03.10.2026): смена темы меняет цвета переходом `--ease` 180 мс, а
 * `data-theme` ставит слушатель React мгновением позже возврата `emulateMedia`. Спек, который
 * переключил тему и сразу замерил контраст, попадает в это окно и видит цвета, которых нет ни в
 * одной теме, отсюда «блуждающий» красный axe по разным спекам. Ожидание живёт в `fixtures.ts`;
 * этот тест держит его на месте: снимут обёртку `emulateMedia` — тест покраснеет.
 */
test('после смены темы тема применена и переходов цвета в полёте нет', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/guests/birthdays');
  for (const theme of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    const state = await page.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      flying: document.getAnimations().filter((a) => a.constructor.name === 'CSSTransition').length,
    }));
    expect(state.theme, 'тема применена к моменту замера').toBe(theme);
    expect(state.flying, `тема ${theme}: переходов цвета в полёте`).toBe(0);
  }
});

/**
 * Тот же класс ошибок без смены темы (разбор 09.10.2026, «История ночи» в `market.spec`): панель выезжает CSS-анимацией
 * `drawer-in`, и axe, позванный сразу после щелчка, мерил полупрозрачный текст, цвета плавали от прогона к прогону.
 * Ожидание живёт в `fixtures.ts` обёрткой `AxeBuilder.analyze`; этот тест держит его на месте.
 */
test('axe замеряет после конца анимаций на странице', async ({ page }) => {
  await page.goto('/guests/birthdays');
  await page.evaluate(() => {
    const el = document.createElement('div');
    el.textContent = 'движется';
    document.body.append(el);
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600 });
  });
  await new AxeBuilder({ page }).include('body').analyze();
  const running = await page.evaluate(
    () => document.getAnimations().filter((a) => a.playState === 'running').length,
  );
  expect(running, 'анимаций в полёте к моменту замера').toBe(0);
});
