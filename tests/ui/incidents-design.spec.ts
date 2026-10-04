import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API, HEADER_GROWTH_PX } from './fixtures';

/**
 * «Неисправности» без каши (поручение владельца 21.09.2026 по снимку рабочего экрана).
 *
 * Экран проверяется в том состоянии, в каком его видит смена: четыре открытые неисправности разом —
 * срочная техника, ошибка программы, данные и бронь без ячейки, плюс закрытые за сутки
 * (`POST /__test/control {"incidentsMix": true}`). Проверяется не оформление, а чтение: что видно
 * без прокрутки, в каком порядке, сколько цветных плашек в строке и какими словами названо время.
 */
const fixture = FIXTURE_API;

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
  await request.post(`${fixture}/__test/control`, { data: { incidentsMix: true } });
});

test('неисправности: срочное сверху, вся выборка без прокрутки, время и ответственный словами', async ({
  page,
}) => {
  const main = page.getByRole('main');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/incidents');
  const rows = main.getByTestId('incident-row');
  await expect(rows).toHaveCount(4);

  // порядок: срочная техника первой, принятая — последней (раньше первой шла бронь без ячейки)
  await expect(rows.first()).toContainText('Стойка PMS не отвечает');
  await expect(rows.last()).toContainText('Лента броней каналов не читалась');

  // все четыре открытые видны без прокрутки: сводка и состояние сторожа не занимают экран. Бюджет задан
  // 21.09.2026 при прежней шапке; с ADR-134 шапка выше на HEADER_GROWTH_PX, место под содержимое то же
  const lastBottom = await rows.last().evaluate((el) => el.getBoundingClientRect().bottom);
  expect(lastBottom, 'список открытых не помещается в первый экран').toBeLessThanOrEqual(
    1000 + HEADER_GROWTH_PX,
  );

  // время словами: «держится 20 ч 26 мин», а не «1226 мин»
  await expect(rows.first()).toContainText(/держится 20 ч \d+ мин/i);
  await expect(main.getByText(/\d{3,}\s*мин/)).toHaveCount(0);

  // одна цветная плашка в строке: статус. Срочность — словом и полосой, не вторым бейджем
  await expect(rows.first().locator('.badge')).toHaveCount(1);
  await expect(rows.first().getByTestId('incident-status')).toHaveText('ждёт человека');
  await expect(rows.first()).toContainText('Срочно');
  await expect(rows.first()).toHaveAttribute('data-severity', 'CRITICAL');

  // кто отвечает — одной фразой; «не чинит — не его класс» в каждой строке больше нет
  await expect(rows.first()).toContainText('Чинит сторож: 2 попытки');
  await expect(main.getByText('не чинит — не его класс')).toHaveCount(0);
  await expect(rows.nth(1)).toContainText('дежурный агент');

  // состояние сторожа — одной полосой: числа, сторож, проход, будильник
  await expect(main.getByTestId('incidents-open')).toHaveText('4');
  await expect(main.getByTestId('guard-running')).toContainText('работает');
  await expect(main.getByTestId('incidents-summary')).toContainText('срочных 1');
});

test('неисправности: чипы со счётчиками вместо двух списков, поиск и сброс', async ({ page }) => {
  const main = page.getByRole('main');
  await page.goto('/incidents');
  // два выпадающих списка заменены чипами: они же показывают, сколько чего открыто
  await expect(page.getByLabel('Срочность')).toHaveCount(0);
  await expect(page.getByLabel('Статус неисправности')).toHaveCount(0);

  const chip = (name: string) => main.getByRole('button', { name });
  await expect(chip('Все 4')).toHaveAttribute('aria-pressed', 'true');
  await chip('Срочные 1').click();
  await expect(main.getByTestId('incident-row')).toHaveCount(1);
  await expect(main.getByTestId('incident-row')).toContainText('Стойка PMS не отвечает');
  await chip('Ждут человека 2').click();
  await expect(main.getByTestId('incident-row')).toHaveCount(2);

  // поиск складывается с чипом, а пустой результат говорит, по какому условию пусто
  await main.getByLabel('Поиск неисправности').fill('Лента');
  const empty = main.getByTestId('incidents-filter-empty');
  await expect(empty).toContainText('Лента');
  await empty.getByRole('button', { name: 'Сбросить фильтры' }).click();
  await expect(main.getByTestId('incident-row')).toHaveCount(4);
  await expect(chip('Все 4')).toHaveAttribute('aria-pressed', 'true');
});

test('неисправности: закрытые за сутки убраны под раскрывашку и открываются по щелчку', async ({
  page,
}) => {
  const main = page.getByRole('main');
  await page.goto('/incidents');
  const history = main.getByTestId('incidents-closed');
  await expect(history).toContainText('Закрыты за сутки: 3');
  // свёрнутая раскрывашка: записи в разметке есть (их читает поиск по странице), но экран ими не занят
  await expect(main.getByTestId('incidents-closed-row').first()).toBeHidden();
  await history.locator('summary').click();
  await expect(main.getByTestId('incidents-closed-row')).toHaveCount(3);
  await expect(main.getByTestId('incidents-closed-row').first()).toBeVisible();
  await expect(main.getByTestId('incidents-closed-row').first()).toContainText('сторож');
});

test('неисправности: телефон — карточка, цели 44 px, без прокрутки вбок, доступность', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const main = page.getByRole('main');
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/incidents');
      await expect(main.getByTestId('incident-row')).toHaveCount(4);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `неисправности шире экрана ${width}`,
      ).toBe(true);
      if (width === 390) {
        const buttons = await main
          .getByTestId('incident-row')
          .first()
          .getByRole('button')
          .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
        expect(Math.min(...buttons)).toBeGreaterThanOrEqual(44);
        const chips = await main
          .getByTestId('incidents-filter')
          .getByRole('button')
          .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
        expect(Math.min(...chips)).toBeGreaterThanOrEqual(44);
      }
      const audit = await new AxeBuilder({ page })
        .include('main')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(audit.violations).toEqual([]);
    }
  }
});
