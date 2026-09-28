import type { Locator } from '@playwright/test';

/**
 * Выбрать услугу в форме начисления по названию. Код услуги и подпись пункта («Группа: название — цена»)
 * задаёт справочник объекта, поэтому `selectOption(название)` их не находит: ищем пункт по тексту
 * и выбираем его значение. 28.09.2026 сид стенда сменил код услуги, и `finance` и `full-day` падали по таймауту выбора.
 */
export async function selectService(form: Locator, name: string): Promise<void> {
  const select = form.locator('select[name="serviceCode"]');
  const code = await select.locator('option', { hasText: name }).getAttribute('value');
  if (!code) throw new Error(`В справочнике стенда нет услуги «${name}»`);
  await select.selectOption(code);
}
