import type { Locator } from '@playwright/test';
import { AUTO_UNIT } from '../../apps/web/src/lib/booking-link';

/**
 * Настоящие места в списке «Ячейка» формы брони — без «назначить позже» и «Автоматически — первая свободная»
 * (`@auto`, «Свободные места» AV3). 28.09.2026 AV3 поставил «автоматически» вторым пунктом, и пять живых спеков,
 * бравших место как `option.nth(1)`, стали бронировать «@auto» и искать бронь на месте с таким кодом.
 */
export async function unitCodes(select: Locator): Promise<string[]> {
  const values = await select
    .locator('option')
    .evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value));
  return values.filter((value) => value && value !== AUTO_UNIT);
}
