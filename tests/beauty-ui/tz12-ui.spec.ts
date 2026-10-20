import { chooseCalendarEmployee } from './calendar-employee';
import { test, expect } from '../ui/fixtures';
import { writeFileSync, mkdirSync } from 'node:fs';
import { seed, date, evidence } from './tz11-helpers';

const longName = 'Тест Александра-Вероника Длинное синтетическое имя клиента';
async function populated(page: Parameters<typeof seed>[0], request: Parameters<typeof seed>[1]) {
  const f = await seed(page, request);
  await f.book('10:00', 0, 0, longName);
  for (const [hour, master, service] of [
    ['12:00', 0, 1],
    ['14:00', 0, 0],
    ['10:00', 1, 1],
    ['12:00', 1, 0],
  ] as const)
    await f.book(hour, master, service);
  return f;
}
const phase = process.env.TZ12_PHASE || 'after';
test('capture paired operational screens', async ({ page, request }) => {
  test.setTimeout(240000);
  await populated(page, request);
  const manifest: object[] = [];
  mkdirSync(evidence + '/screenshots', { recursive: true });
  for (const width of [390, 1440])
    for (const theme of ['light', 'dark'] as const) {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      for (const path of ['calendar', 'appointments', 'customers', 'services']) {
        await page.goto(`/${path}?date=${date}`);
        await expect(page.locator('main')).toBeVisible();
        await page.evaluate((t) => {
          document.documentElement.dataset.theme = t;
        }, theme);
        await page.screenshot({
          path: `${evidence}/screenshots/${phase}-${path}-${width}-${theme}.png`,
          fullPage: false,
        });
        manifest.push({
          phase,
          path,
          width,
          theme,
          fixture: 'dense-5-synthetic-long-name-no-phone',
          file: `screenshots/${phase}-${path}-${width}-${theme}.png`,
        });
      }
    }
  writeFileSync(`${evidence}/${phase}-manifest.json`, JSON.stringify(manifest, null, 2));
});

test('calendar compact controls preserve filtering and hidden occupancy', async ({
  page,
  request,
}) => {
  await populated(page, request);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/calendar?date=${date}`);
  const timeline = page.getByTestId('beauty-mobile-calendar').locator('.beauty-mobile-timeline');
  await expect(timeline).toBeVisible();
  // Geometry-only diagnostics preserve the compactness limit without logging customer data.
  const layout = await page.getByRole('main').evaluate((main) =>
    Array.from(main.children).flatMap((node) => [node, ...Array.from(node.children)]).map((node) => {
      const rect = node.getBoundingClientRect();
      return { tag: node.tagName, classes: String(node.className), x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }),
  );
  // 422 → 470: «Компактный вид» добавил тулбару ряд 44px (салонный выпуск 18.10), при 2x шрифте
  // на 320 кнопки не делят ряд, поэтому ряд не убрать; «Записей: N» переехал в ряд «День | Неделя».
  expect((await timeline.boundingBox())!.y, JSON.stringify(layout)).toBeLessThanOrEqual(470);
  await expect(page.getByLabel('Статус записи', { exact: true })).not.toBeVisible();
  await page.getByText(/^Фильтры/).click();
  await page.getByLabel('Статус записи', { exact: true }).selectOption('DONE');
  await expect(timeline.getByText('Занято, скрыто фильтром')).toHaveCount(3);
  await expect(
    timeline.getByRole('button', { name: 'Тест Анна, 10:00, свободно', exact: true }),
  ).toHaveCount(0);
  await expect(timeline).not.toContainText(longName);
  await page.getByRole('button', { name: 'Сбросить фильтры', exact: true }).click();
  await expect(timeline.locator('.beauty-tile')).toHaveCount(3);
  await chooseCalendarEmployee(page, 'Тест Борис');
  await expect(page.locator('.employee-filter summary')).toContainText('Тест Борис');
});

test('list mobile cards retain contact semantics and honest record action', async ({
  page,
  request,
}) => {
  await populated(page, request);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/appointments?date=${date}`);
  await expect(page.getByText('Поиск по выбранному периоду.')).toBeVisible();
  await expect(page.locator('.beauty-appointments-table')).not.toContainText('—');
  const row = page.locator('.beauty-appointments-table tr').filter({ hasText: longName });
  await expect(row.getByRole('button', { name: /Открыть запись/ })).toBeVisible();
  await row.getByRole('button', { name: /Открыть запись/ }).click();
  await expect(page.getByRole('dialog', { name: 'Запись', exact: true })).toBeVisible();
});

test('shared form groups and save stay accessible in short viewport', async ({ page, request }) => {
  await seed(page, request);
  await page.setViewportSize({ width: 390, height: 560 });
  await page.goto(`/appointments?date=${date}`);
  await page.getByRole('button', { name: '+ Новая запись', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Новая запись', exact: true });
  for (const name of ['Клиент', 'Услуга и время', 'Дополнительно'])
    await expect(dialog.getByRole('group', { name, exact: true })).toBeVisible();
  await dialog.getByLabel('Заметка', { exact: true }).focus();
  await expect(dialog.getByLabel('Заметка', { exact: true })).toBeInViewport();
  await expect(dialog.getByRole('button', { name: 'Записать', exact: true })).toBeInViewport();
  const note = (await dialog.getByLabel('Заметка', { exact: true }).boundingBox())!;
  const save = (await dialog.getByRole('button', { name: 'Записать', exact: true }).boundingBox())!;
  expect(note.y + note.height).toBeLessThanOrEqual(save.y);
});

for (const width of [320, 768, 1440])
  for (const theme of ['light', 'dark'] as const)
    test(`operational reflow ${width} ${theme}`, async ({ page, request }, testInfo) => {
      await populated(page, request);
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ colorScheme: theme });
      for (const path of ['calendar', 'appointments', 'customers', 'services']) {
        await page.goto(`/${path}?date=${date}`);
        if (width === 320)
          await page.evaluate(() => {
            const elements = [...document.querySelectorAll<HTMLElement>('main h1, main .page__subtitle, main .btn, main .field > span, main .inp, main td, main .beauty-note, main summary')];
            const sizes = elements.map(el => parseFloat(getComputedStyle(el).fontSize));
            elements.forEach((el, index) => { el.style.fontSize = `${sizes[index]! * 2}px`; });
          });
        const reflow = await page.evaluate(() => ({
          fits: document.documentElement.scrollWidth <= innerWidth,
          viewport: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          overflow: [...document.querySelectorAll<HTMLElement>('main *')]
            .map((el) => {
              const box = el.getBoundingClientRect();
              const style = getComputedStyle(el);
              return { tag: el.tagName, className: el.className, left: box.left, right: box.right,
                width: box.width, fontSize: style.fontSize, minWidth: style.minWidth,
                gridTemplateColumns: style.gridTemplateColumns };
            })
            .filter((el) => el.width > 0 && (el.right > innerWidth || el.left < 0))
            .slice(0, 30),
        }));
        if (!reflow.fits) {
          await testInfo.attach(`reflow-${path}-${width}-${theme}`, {
            body: JSON.stringify(reflow), contentType: 'application/json',
          });
          console.info('REFLOW_OVERFLOW', JSON.stringify({ path, width, theme, ...reflow }));
        }
        expect(reflow.fits, path).toBeTruthy();
      }
    });
