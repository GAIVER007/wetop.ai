import { test, expect } from '../ui/fixtures';
import { mkdirSync } from 'node:fs';
import { seed, date, evidence } from './tz11-helpers';

/**
 * Владелец 29.10.2026: «под телефон и комп сделали, теперь планшет и складной iPhone Duo; чётко, ровно, без дёрганий
 * и кривого». Ширины: внешний экран Duo 466, раскрытый Duo 626 и боком 890 (Apple: 1878×2670 и 1398×2034 px при
 * масштабе 3), iPad mini 744, iPad 820 и боком 1180, iPad Pro 13 боком 1376.
 * Правило: страница не листается вбок, ничего не вылезает за экран, у записей на планшете (601–960) карточки в две
 * колонки одинаковой ширины, кнопка «Открыть запись» внутри карточки, кнопки и поля на сенсоре не ниже 44 px.
 */
const longName = 'Тест Александра-Вероника Длинное синтетическое имя клиента';
const WIDTHS = [466, 626, 744, 820, 890, 1180, 1376] as const;

test('записи и журнал салона на планшетах и складном iPhone: без вылезаний, карточки ровно', async ({ page, request }) => {
  test.setTimeout(300_000);
  const f = await seed(page, request);
  await f.book('10:00', 0, 0, longName);
  for (const [hour, master, service] of [['12:00', 0, 1], ['14:00', 0, 0], ['10:00', 1, 1], ['12:00', 1, 0]] as const)
    await f.book(hour, master, service);
  mkdirSync(`${evidence}/tablet`, { recursive: true });
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: width > 1000 ? 820 : 1000 });
    for (const path of ['appointments', 'calendar', 'customers']) {
      await page.goto(`/${path}?date=${date}`);
      await expect(page.locator('main')).toBeVisible();
      const over = await page.evaluate(() => {
        const iw = document.documentElement.clientWidth;
        const scrolls = (e: Element | null): boolean => {
          for (let p = e?.parentElement; p; p = p.parentElement) {
            const o = getComputedStyle(p).overflowX;
            if ((o === 'auto' || o === 'scroll') && p.scrollWidth > p.clientWidth) return true;
          }
          return false;
        };
        const wide = [...document.querySelectorAll('main *')]
          .filter((e) => {
            const b = e.getBoundingClientRect();
            return b.width > 0 && b.right > iw + 1 && getComputedStyle(e).position !== 'fixed' && !scrolls(e);
          })
          .map((e) => `${e.tagName.toLowerCase()}.${String((e as HTMLElement).className).split(' ')[0]}`);
        return { page: document.documentElement.scrollWidth - iw, wide: [...new Set(wide)].slice(0, 5) };
      });
      expect(over, `${path} ${width}`).toEqual({ page: 0, wide: [] });
      await page.screenshot({ path: `${evidence}/tablet/${path}-${width}.png` });
    }
    // записи на планшете: две ровные колонки карточек, кнопка внутри карточки
    if (width >= 601 && width <= 960) {
      await page.goto(`/appointments?date=${date}`);
      const cards = page.locator('.beauty-appointments-table tbody tr');
      await expect(cards).toHaveCount(5);
      const boxes = await cards.evaluateAll((rows) =>
        rows.map((r) => {
          const b = r.getBoundingClientRect();
          const btn = r.querySelector('td[data-col="actions"] .btn')!.getBoundingClientRect();
          return { x: Math.round(b.x), w: Math.round(b.width), h: Math.round(b.height), btn: Math.round(btn.bottom - b.bottom) };
        }),
      );
      expect(new Set(boxes.map((b) => b.x)).size, `колонки ${width}`).toBe(2);
      expect(new Set(boxes.map((b) => b.w)).size, `одна ширина ${width}`).toBe(1);
      // ровно: все карточки одной высоты, «Открыть запись» у всех на одном расстоянии от низа карточки
      expect(new Set(boxes.map((b) => b.h)).size, `одна высота ${width}: ${boxes.map((b) => b.h)}`).toBe(1);
      expect(new Set(boxes.map((b) => b.btn)).size, `кнопки на одной линии ${width}`).toBe(1);
      // фильтры строгой сеткой: две колонки одной ширины, левые края по двум линиям
      const bar = await page.locator('.beauty-list-bar > *').evaluateAll((els) =>
        els.map((e) => e.getBoundingClientRect()).map((b) => ({ x: Math.round(b.x), w: Math.round(b.width), h: Math.round(b.height) })),
      );
      expect(new Set(bar.map((b) => b.x)).size, `фильтры две линии ${width}`).toBe(2);
      expect(new Set(bar.filter((b) => b.w < width / 2).map((b) => b.w)).size, `фильтры одной ширины ${width}`).toBe(1);
      // без пустой половины ряда: каждый ряд заполнен целиком (две половины или одно поле на всю ширину)
      const full = await page.locator('.beauty-list-bar').evaluate((el) => {
        const w = el.getBoundingClientRect().width;
        const rows = new Map<number, number>();
        for (const c of el.children) {
          const b = c.getBoundingClientRect();
          rows.set(Math.round(b.top), (rows.get(Math.round(b.top)) ?? 0) + b.width);
        }
        return [...rows.values()].every((sum) => sum >= w * 0.9);
      });
      expect(full, `ряды фильтров заполнены ${width}`).toBe(true);
      const inside = await cards.first().evaluate((tr) => {
        const btn = tr.querySelector('td[data-col="actions"] .btn')!.getBoundingClientRect();
        const b = tr.getBoundingClientRect();
        return btn.left >= b.left && btn.right <= b.right;
      });
      expect(inside).toBe(true);
      // длинное имя клиента в карточке целиком (переносится, не режется многоточием)
      const long = cards.filter({ hasText: longName });
      await expect(long).toHaveCount(1);
      expect(await long.locator('td[data-col="client"]').evaluate((td) => td.scrollWidth <= td.clientWidth + 1)).toBe(true);
      // кнопка с длинным именем не наезжает на соседние строки карточки, текст внутри кнопки
      const fit = await long.locator('td[data-col="client"] .btn').evaluate((b) => b.scrollHeight <= b.clientHeight + 1);
      expect(fit, `имя в кнопке ${width}`).toBe(true);
      // поле периода показывает дату целиком (без многоточия)
      const period = page.getByTestId('appointments-period');
      expect(await period.evaluate((e) => e.scrollWidth <= e.clientWidth + 1), `период ${width}`).toBe(true);
    }
  }
});

test('на сенсорном планшете кнопки и поля записей не ниже 44 px', async ({ browser }) => {
  const ctx = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 820, height: 1180 } });
  const page = await ctx.newPage();
  const f = await seed(page, page.request);
  await f.book('10:00', 0, 0);
  await page.goto(`/appointments?date=${date}`);
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('main .btn, main .inp, main select, main summary')]
      .filter((e) => { const b = e.getBoundingClientRect(); return b.height > 0 && b.height < 43.5; })
      .map((e) => `${e.tagName.toLowerCase()}.${String((e as HTMLElement).className).split(' ').join('.')}:${Math.round(e.getBoundingClientRect().height)}`),
  );
  expect(small).toEqual([]);
  await ctx.close();
});
