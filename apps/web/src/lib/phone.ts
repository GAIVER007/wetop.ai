import type { FormEvent } from 'react';
import { formatPhone, formatPhoneInput } from '@pms/domain';

/**
 * Телефон в полях и на экранах (владелец 22.10.2026): «+7 777 777 77 77». Для полей без состояния (`defaultValue`)
 * `onInput={phoneOnInput}` переписывает значение по мере набора; в базу номер уходит как раньше (сервер нормализует).
 */
export function phoneOnInput(event: FormEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  const next = formatPhoneInput(input.value);
  if (next !== input.value) input.value = next;
}

/**
 * Начальное значение поля телефона (`defaultValue`): ровно то, что поле само покажет после ввода. Иначе сохранённый
 * номер, который `formatPhone` и `formatPhoneInput` пишут по-разному (чужой код страны), выглядит изменённым, и форма
 * спрашивает «Несохранённые изменения» без правок (CI beauty-ui 22.10.2026, «+0000000008»).
 */
export function phoneFieldValue(raw: string | null | undefined): string {
  if (!raw) return '';
  const shown = formatPhone(raw);
  return formatPhoneInput(shown) === shown ? shown : formatPhoneInput(raw);
}

export { formatPhone, formatPhoneInput };
