import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Цикл уборки на шахматке и в карточке ячейки (22.09.2026, поручение владельца по снимку: «построй логику
 * чёткую по значкам: требует уборки → убрано → проверено → после проверено номер становится доступным»).
 *
 * Было (21.09): щётка стояла только у грязной ячейки, а меню предлагало сразу и «Убрано», и «Проверено»;
 * после «Убрано» значок пропадал, и «убрано» было неотличимо от «проверено». Стало: три состояния
 * различимы — щётка тоном внимания «требует уборки», значок «убрано, ждёт проверки», без значка —
 * «проверено, доступна»; меню и кнопки карточки предлагают только следующий шаг (и возврат в уборку),
 * а API отказывает перепрыгнуть проверку. Фикстура: R01 и M01 требуют уборки, остальные проверены.
 */
const fixture = 'http://127.0.0.1:4311';

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('шахматка: цикл в строке — требует уборки → убрано, ждёт проверки → проверено, доступна', async ({
  page,
}) => {
  const main = page.getByRole('main');
  await page.goto('/chessboard');
  const glyphs = main.getByTestId('unit-housekeeping');
  await expect(glyphs).toHaveCount(2);
  await expect(main.locator('.board__unit').filter({ hasText: 'грязно' })).toHaveCount(0);

  const r01 = main.getByTestId('unit-row').filter({ hasText: /\bR01\b/ });
  const glyph = r01.getByTestId('unit-housekeeping');
  await expect(glyph).toHaveAttribute('data-status', 'DIRTY');
  await expect(glyph.getByRole('button')).toHaveAccessibleName(/требует уборки/);
  const box = await glyph.getByRole('button').boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(24);
  expect(box!.height).toBeLessThanOrEqual(38);

  // шаг 1: из «требует уборки» — только «Убрано»; перепрыгнуть на «Проверено» меню не даёт
  await glyph.getByRole('button').click();
  let menu = page.getByRole('menu', { name: /уборк/i });
  await expect(menu.getByRole('menuitem', { name: 'Убрано' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Проверено' })).toHaveCount(0);
  await expect(menu.getByRole('menuitem', { name: /карточк/i })).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Убрано' }).click();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: /R01 убрана, ждёт проверки/ })
      .first(),
  ).toBeVisible();

  // ячейка не пропала из уборки: значок сменился, статус — «убрано, ждёт проверки»
  await expect(glyph).toHaveAttribute('data-status', 'CLEAN');
  await expect(glyph.getByRole('button')).toHaveAccessibleName(/убрано, ждёт проверки/);
  await expect(glyphs).toHaveCount(2);

  // шаг 2: из «убрано» — «Проверено» или назад в уборку; «Убрано» повторно не предлагается
  await glyph.getByRole('button').click();
  menu = page.getByRole('menu', { name: /уборк/i });
  await expect(menu.getByRole('menuitem', { name: 'Проверено' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Требует уборки' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Убрано' })).toHaveCount(0);
  await menu.getByRole('menuitem', { name: 'Проверено' }).click();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: /R01 проверена, доступна/ })
      .first(),
  ).toBeVisible();

  // после проверки ячейка доступна: значка в строке нет, в уборке осталась одна M01
  await expect(glyph).toHaveCount(0);
  await expect(glyphs).toHaveCount(1);
  // счётчик уборки — в пункте поля «Места» (PR 7 «Шахматки v2»)
  await expect(main.getByLabel('Места на шахматке').locator('option[value="cleaning"]')).toHaveText(
    'Уборка 1',
  );
});

test('шахматка: «Уборка» в фильтрах считает всё, что ещё не проверено', async ({ page }) => {
  const main = page.getByRole('main');
  await page.goto('/chessboard');
  // «Уборка N» — пункт поля «Места» (PR 7 «Шахматки v2»), а не чип
  const places = main.getByLabel('Места на шахматке');
  const cleaning = places.locator('option[value="cleaning"]');
  await expect(cleaning).toHaveText('Уборка 2');
  const r01 = main.getByTestId('unit-row').filter({ hasText: /\bR01\b/ });
  await r01.getByTestId('unit-housekeeping').getByRole('button').click();
  await page
    .getByRole('menu', { name: /уборк/i })
    .getByRole('menuitem', { name: 'Убрано' })
    .click();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: /убрана/ })
      .first(),
  ).toBeVisible();
  // строка обновляется через router.refresh() после ответа — ждём новый статус, а не читаем прежний
  await expect(r01.getByTestId('unit-housekeeping')).toHaveAttribute('data-status', 'CLEAN');
  // убранная, но не проверенная ячейка всё ещё в списке уборки
  await expect(cleaning).toHaveText('Уборка 2');
  await places.selectOption('cleaning');
  await expect(main.getByTestId('unit-row')).toHaveCount(2);
  const statuses = await main
    .getByTestId('unit-housekeeping')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-status')).sort());
  expect(statuses).toEqual(['CLEAN', 'DIRTY']);
});

test('шахматка: легенда называет значки уборки и что значит их отсутствие', async ({ page }) => {
  await page.goto('/chessboard');
  const legend = page.getByTestId('board-legend');
  await expect(legend).toContainText('требует уборки');
  await expect(legend).toContainText('убрано, ждёт проверки');
  await expect(legend).toContainText('проверена, доступна');
});

test('карточка ячейки: цикл словами, кнопки — только следующий шаг и возврат в уборку', async ({
  page,
}) => {
  const main = page.getByRole('main');
  await page.goto('/units/R01');
  const panel = main.getByTestId('housekeeping-panel');
  const flow = panel.getByRole('list', { name: /порядок уборки/i });
  await expect(flow.getByRole('listitem')).toHaveCount(3);

  await expect(panel).toContainText('Сейчас требует уборки');
  await expect(flow.locator('[aria-current="step"]')).toHaveText('требует уборки');
  await expect(panel.getByTestId('hk-CLEAN')).toHaveText('Убрано');
  await expect(panel.getByTestId('hk-INSPECTED')).toHaveCount(0);
  await expect(panel.getByTestId('hk-DIRTY')).toHaveCount(0);

  await panel.getByTestId('hk-CLEAN').click();
  await expect(panel).toContainText('Сейчас убрано, ждёт проверки');
  await expect(flow.locator('[aria-current="step"]')).toHaveText('убрано, ждёт проверки');
  await expect(panel.getByTestId('hk-INSPECTED')).toHaveText('Проверено');
  await expect(panel.getByTestId('hk-DIRTY')).toHaveText('Требует уборки');
  await expect(panel.getByTestId('hk-CLEAN')).toHaveCount(0);

  await panel.getByTestId('hk-INSPECTED').click();
  await expect(panel).toContainText('Сейчас проверено, доступна');
  await expect(flow.locator('[aria-current="step"]')).toHaveText('проверено, доступна');
  await expect(panel.getByTestId('hk-DIRTY')).toHaveText('Требует уборки');
  await expect(panel.getByTestId('hk-CLEAN')).toHaveCount(0);
  await expect(panel.getByTestId('hk-INSPECTED')).toHaveCount(0);

  const audit = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
});

/** Бронь фикстуры с проживанием в R01 (та же, что в manager-actions) */
const BOOKING = '20260913-TESTAA';
const actionsTab = (page: Page) => page.getByRole('tab', { name: 'Действия', exact: true }).click();

test('карточка брони: заселение в непроверенную ячейку предупреждает, но не запрещает (Q-156)', async ({
  page,
  request,
}) => {
  await page.goto(`/reservations/${BOOKING}`);
  await actionsTab(page);
  // пока вкладка догружается, в DOM на миг есть скрытая копия панели — жмём видимую кнопку
  const checkIn = page.getByTestId('check-in-ui-item').filter({ visible: true });
  await checkIn.click();
  const warn = page.getByRole('dialog', { name: 'Ячейка R01 ещё не проверена. Заселить?' });
  await expect(warn).toContainText('требует уборки');
  await warn.getByRole('button', { name: 'Оставить' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // «Оставить» ничего не шлёт
  expect(await (await request.get(`${fixture}/__test/commands`)).json()).toEqual([]);
  await checkIn.click();
  await page
    .getByRole('dialog', { name: 'Ячейка R01 ещё не проверена. Заселить?' })
    .getByRole('button', { name: 'Заселить всё равно' })
    .click();
  await expect(page.getByRole('status').filter({ hasText: 'Гость заселён' })).toBeVisible();
  const commands = await (await request.get(`${fixture}/__test/commands`)).json();
  expect(commands.map((c: { method: string; path: string }) => `${c.method} ${c.path}`)).toEqual([
    `POST /reservations/${BOOKING}/items/ui-item/check-in`,
  ]);
});

test('выезд сам переводит ячейку в «требует уборки», и цикл начинается заново (Q-155)', async ({
  page,
}) => {
  // ячейка проверена и доступна — заселение без предупреждения
  await page.goto('/units/R01');
  const panel = page.getByRole('main').getByTestId('housekeeping-panel');
  await panel.getByTestId('hk-CLEAN').click();
  await expect(panel).toContainText('Сейчас убрано, ждёт проверки');
  await panel.getByTestId('hk-INSPECTED').click();
  await expect(panel).toContainText('Сейчас проверено, доступна');
  await page.goto(`/reservations/${BOOKING}`);
  await actionsTab(page);
  await page.getByTestId('check-in-ui-item').filter({ visible: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Гость заселён' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // выезд с долгом — окно с суммой, как и раньше
  await page.getByTestId('check-out-ui-item').filter({ visible: true }).click();
  await page
    .getByRole('dialog', { name: 'Выселить с долгом?' })
    .getByRole('button', { name: 'Выселить с долгом' })
    .click();
  await expect(page.getByTestId('check-out-ui-item')).toHaveCount(0);
  // ячейка снова требует уборки: на шахматке щётка, в карточке — первый шаг цикла
  await page.goto('/chessboard');
  const r01 = page
    .getByRole('main')
    .getByTestId('unit-row')
    .filter({ hasText: /\bR01\b/ });
  await expect(r01.getByTestId('unit-housekeeping')).toHaveAttribute('data-status', 'DIRTY');
  await page.goto('/units/R01');
  await expect(page.getByRole('main').getByTestId('housekeeping-panel')).toContainText(
    'Сейчас требует уборки',
  );
});
