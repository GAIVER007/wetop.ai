import { normalizePhone, type Parsed } from './web-booking/request';

/** ТЗ 4: местный десятизначный номер Казахстана; явный международный + сохраняется. */
export function customerPhoneKey(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const phone = raw.replace(/[\u00a0\u202f]/g, ' ').replace(/^[ \t\r\n\v\f]+|[ \t\r\n\v\f]+$/g, '');
  if (!/^\+?[0-9 ().\t\r\n\v\f-]+$/.test(phone)) return null;
  const digits = phone.replace(/\D/g, '');
  return normalizePhone(digits.length === 10 && !phone.startsWith('+') ? `7${digits}` : phone);
}

export interface CustomerInput {
  firstName: string;
  lastName: string | null;
  phone: string;
}

export function parseCustomerInput(raw: unknown): Parsed<CustomerInput> {
  const body = (raw ?? {}) as Record<string, unknown>;
  const firstName = typeof body['firstName'] === 'string' ? body['firstName'].trim() : '';
  if (!firstName || firstName.length > 100) return { ok: false, reason: 'Имя клиента: от 1 до 100 символов' };
  const lastName = typeof body['lastName'] === 'string' ? body['lastName'].trim() : '';
  if (lastName.length > 100) return { ok: false, reason: 'Фамилия клиента: не больше 100 символов' };
  const phone = typeof body['phone'] === 'string' ? body['phone'].trim() : '';
  if (phone.length > 32 || !customerPhoneKey(phone))
    return { ok: false, reason: 'Укажите телефон клиента: +7, 8 или 10 цифр местного номера' };
  return { ok: true, value: { firstName, lastName: lastName || null, phone } };
}
