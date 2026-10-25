import { test, expect } from '../ui/fixtures';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { kk } from '../../apps/web/src/i18n/kk';

/**
 * KK2 (план `plans/desk-kk-2026-10-23.md`): экраны салона на казахском целиком. Что в коде не осталось русского текста
 * мимо перевода, доказывает unit `apps/web/src/i18n/kk-screens.test.ts`; здесь настоящий браузер: экран открывается на
 * казахском без сбоя, заголовок стал переводом, длинные казахские слова не ломают вёрстку телефона, axe чисто.
 * Язык задаёт кука `wetop_locale`: подставной `/auth/me` стенда языка не отдаёт, и стойка берёт куку.
 */
const api = `http://127.0.0.1:${process.env.BEAUTY_UI_API_PORT || '26814'}`;
const SCREENS = [
  '/calendar',
  '/appointments',
  '/customers',
  '/services',
  '/employees',
  '/beauty/schedule',
  '/beauty-settings',
  '/finance',
  '/cashbox',
  '/reports',
  '/my-work',
];

async function locale(page: Page, code: 'ru' | 'kk') {
  await page.context().addCookies([{ name: 'wetop_locale', value: code, domain: '127.0.0.1', path: '/' }]);
}

test.beforeEach(async ({ page, request }) => {
  test.setTimeout(180_000);
  const response = await request.post(`${api}/__test/reset`);
  expect(response.ok()).toBe(true);
  const f: { business: string; locations: string[] } = await response.json();
  await page.context().addCookies([
    {
      name: 'wetop_scope',
      value: encodeURIComponent(`business=${f.business};location=${f.locations[0]!}`),
      domain: '127.0.0.1',
      path: '/',
    },
  ]);
});

for (const path of SCREENS)
  test(`${path}: на казахском, заголовок переведён, телефон без прокрутки вбок`, async ({ page }) => {
    await locale(page, 'ru');
    await page.goto(path);
    const heading = page.getByRole('heading', { level: 1 }).first();
    const ru = (await heading.textContent())?.trim() ?? '';
    expect(ru, 'у экрана есть заголовок').not.toBe('');

    await locale(page, 'kk');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'kk');
    // заголовок есть в словаре («Журнал» и «Касса» по-казахски пишутся так же, это тоже перевод)
    expect(kk[ru], `перевод заголовка «${ru}»`).toBeDefined();
    await expect(heading).toHaveText(kk[ru]!);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(heading).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, 'горизонтальная прокрутка').toBeLessThanOrEqual(0);
  });

for (const scheme of ['light', 'dark'] as const)
  test(`axe: казахский не добавляет нарушений журналу и клиентам, ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    // мерим тот же экран на русском и на казахском: перевод не должен давать нарушений сверх русского вида
    // (на 24.10.2026 у пустого списка клиентов есть прежнее heading-order: h3 пустого состояния сразу после h1)
    const found = async (code: 'ru' | 'kk', path: string) => {
      await locale(page, code);
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('lang', code);
      const result = await new AxeBuilder({ page }).include('main').analyze();
      return result.violations.map((v) => `${v.id} × ${v.nodes.length}`).sort();
    };
    for (const path of ['/calendar', '/customers'])
      expect(await found('kk', path), path).toEqual(await found('ru', path));
  });
