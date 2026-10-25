import { msg } from '../../../i18n';
import { inputToMinor } from '../../../lib/money';

/**
 * Проверка формы «Новая услуга» до отправки (аудит салона 22.10.2026: «Сохранить услугу» с пустыми полями молчала):
 * сообщение под каждым полем, браузерные подсказки выключены (`noValidate`).
 */
export type ServiceFieldErrors = Partial<Record<'name' | 'durationMinutes' | 'price', string>>;

export function serviceFieldErrors(draft: { name: string; durationMinutes: string; price: string }): ServiceFieldErrors {
  const errors: ServiceFieldErrors = {};
  if (!draft.name.trim()) errors.name = msg('Укажите название услуги');
  const minutes = draft.durationMinutes.trim();
  if (!minutes) errors.durationMinutes = msg('Укажите длительность в минутах, например 60');
  else if (!/^\d+$/.test(minutes) || Number(minutes) <= 0)
    errors.durationMinutes = msg('Длительность: целое число минут больше нуля');
  const price = inputToMinor(draft.price);
  if (price === '') errors.price = msg('Укажите цену, например 5000');
  else if (price === null) errors.price = msg('Цена: число, например 5000 или 5000,50');
  return errors;
}

/** Новая услуга создана и уже продаётся в филиале: окно закрывается, следующего шага в нём нет */
export function closesAfterSave(
  state: { message?: string; error?: string; resourceId?: string; addedToBranch?: boolean } | null,
  editing: boolean,
): boolean {
  return !editing && Boolean(state?.resourceId) && !state?.error && state?.addedToBranch === true;
}
