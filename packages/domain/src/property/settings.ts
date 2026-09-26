import { isOrganizationNameShaped, normalizeOrganizationName } from '../accounts/registration';

/**
 * Что владелец организации правит в «Настройках гостиницы» (ТЗ ux-retention п. 3.1, UQ-1 — «да» владельца 26.09.2026).
 * Валюты и часового пояса здесь нет намеренно: от них зависят суммы и границы ночей, их меняет поддержка WETOP.
 */
export interface HotelSettingsPatch {
  name?: string;
  legalName?: string | null;
  bin?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  checkInTime?: string;
  checkOutTime?: string;
}

export type HotelSettingsParse =
  | { ok: true; value: HotelSettingsPatch }
  | { ok: false; reason: string };

const LOCKED = new Set(['currency', 'timezone']);
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEXT_MAX = 300;

const text = (v: unknown): string | null => {
  if (v === null) return null;
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim();
  return s === '' ? null : s;
};

export function parseHotelSettingsPatch(raw: unknown): HotelSettingsParse {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'Нечего сохранять' };
  const body = raw as Record<string, unknown>;
  const out: HotelSettingsPatch = {};
  for (const key of Object.keys(body)) {
    if (LOCKED.has(key))
      return {
        ok: false,
        reason: 'Валюту и часовой пояс меняет поддержка WETOP: от них зависят деньги и границы ночей.',
      };
    const value = body[key];
    switch (key) {
      case 'name': {
        if (typeof value !== 'string' || !isOrganizationNameShaped(value))
          return { ok: false, reason: 'Укажите название гостиницы' };
        out.name = normalizeOrganizationName(value);
        break;
      }
      case 'legalName':
      case 'address': {
        const s = text(value);
        if (s !== null && s.length > TEXT_MAX)
          return { ok: false, reason: `Не длиннее ${TEXT_MAX} знаков` };
        out[key] = s;
        break;
      }
      case 'bin': {
        const s = text(value);
        if (s !== null && !/^\d{12}$/.test(s)) return { ok: false, reason: 'ИИН/БИН — 12 цифр' };
        out.bin = s;
        break;
      }
      case 'phone': {
        const s = text(value);
        const digits = s?.replace(/\D/g, '').length ?? 0;
        if (s !== null && (digits < 5 || digits > 15))
          return { ok: false, reason: 'Телефон — от 5 до 15 цифр' };
        out.phone = s;
        break;
      }
      case 'email': {
        const s = text(value)?.toLowerCase() ?? null;
        if (s !== null && !EMAIL.test(s)) return { ok: false, reason: 'Почта — в виде name@example.kz' };
        out.email = s;
        break;
      }
      case 'checkInTime':
      case 'checkOutTime': {
        const s = text(value);
        if (s === null || !TIME.test(s))
          return {
            ok: false,
            reason: `Время ${key === 'checkInTime' ? 'заезда' : 'выезда'} — в виде 14:00`,
          };
        out[key] = s;
        break;
      }
      default:
        return { ok: false, reason: `Неизвестное поле: ${key}` };
    }
  }
  if (Object.keys(out).length === 0) return { ok: false, reason: 'Нечего сохранять' };
  return { ok: true, value: out };
}
