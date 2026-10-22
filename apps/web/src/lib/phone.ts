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

export { formatPhone, formatPhoneInput };
