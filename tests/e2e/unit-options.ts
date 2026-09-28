import type { Locator } from '@playwright/test';

/**
 * Ячейки в списке формы новой брони. Первые пункты — «назначить позже» (пусто) и, с AV3 (PR #108, ADR-110),
 * «Автоматически — первая свободная» (`@auto`); настоящие ячейки идут после них. Спеки брали `option.nth(1)` —
 * после AV3 это «Автоматически», и бронь создавалась с автоподбором вместо выбранной ячейки.
 */
const REAL_UNIT = 'option:not([value=""]):not([value="@auto"])';

/** `index`-я настоящая ячейка списка (с нуля) */
export async function unitOption(select: Locator, index = 0): Promise<string> {
  const value = await select.locator(REAL_UNIT).nth(index).getAttribute('value');
  if (!value) throw new Error(`в списке нет свободной ячейки №${index + 1}`);
  return value;
}
