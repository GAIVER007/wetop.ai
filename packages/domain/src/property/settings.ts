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
  countryCode?: string | null;
  city?: string | null;
  channexPropertyType?: string | null;
  /** Карточка объекта (ADR-158, DATA_MODEL §32) */
  description?: string | null;
  website?: string | null;
  publicName?: string | null;
  earlyCheckIn?: boolean;
  lateCheckOut?: boolean;
  childrenAllowed?: boolean;
  petsAllowed?: boolean;
  smokingAllowed?: boolean;
  onsitePayment?: OnsitePayment;
  cancellationRule?: CancellationRule;
  depositRule?: DepositRule;
  minGuestAge?: number;
  quietHoursFrom?: string | null;
  quietHoursTo?: string | null;
  houseRulesNote?: string | null;
  amenities?: string[];
}

export type HotelSettingsParse =
  { ok: true; value: HotelSettingsPatch } | { ok: false; reason: string };

/** Способ оплаты на месте, подпись отмены и залога для карточки (ADR-158): подписи, не финансовая логика (Q-293) */
export const ONSITE_PAYMENTS = ['CASH_CARD', 'CASH', 'CARD', 'TRANSFER'] as const;
export const CANCELLATION_RULES = ['FREE_1D', 'FREE_3D', 'FREE_7D', 'NON_REFUNDABLE'] as const;
export const DEPOSIT_RULES = ['NONE', 'FIRST_NIGHT', 'HALF', 'FULL'] as const;
export type OnsitePayment = (typeof ONSITE_PAYMENTS)[number];
export type CancellationRule = (typeof CANCELLATION_RULES)[number];
export type DepositRule = (typeof DEPOSIT_RULES)[number];
export const ONSITE_PAYMENT_LABELS: Record<OnsitePayment, string> = {
  CASH_CARD: 'Наличные и карта',
  CASH: 'Только наличные',
  CARD: 'Только карта',
  TRANSFER: 'Банковский перевод',
};
export const CANCELLATION_RULE_LABELS: Record<CancellationRule, string> = {
  FREE_1D: 'Бесплатная отмена за 1 день',
  FREE_3D: 'Бесплатная отмена за 3 дня',
  FREE_7D: 'Бесплатная отмена за 7 дней',
  NON_REFUNDABLE: 'Без возврата',
};
export const DEPOSIT_RULE_LABELS: Record<DepositRule, string> = {
  NONE: 'Без залога',
  FIRST_NIGHT: 'Стоимость первой ночи',
  HALF: '50% от стоимости проживания',
  FULL: '100% от стоимости проживания',
};
/** Каталог удобств объекта: порядок каталога это порядок показа и хранения (DATA_MODEL §31.1) */
export const PROPERTY_AMENITIES = [
  { code: 'wifi', label: 'Wi-Fi' },
  { code: 'parking', label: 'Парковка' },
  { code: 'air_conditioning', label: 'Кондиционер' },
  { code: 'kitchen', label: 'Кухня' },
  { code: 'transfer', label: 'Трансфер' },
  { code: 'breakfast', label: 'Завтрак' },
  { code: 'laundry', label: 'Прачечная' },
  { code: 'tv', label: 'Телевизор' },
  { code: 'elevator', label: 'Лифт' },
  { code: 'reception_24h', label: 'Круглосуточная стойка' },
  { code: 'luggage_storage', label: 'Хранение багажа' },
  { code: 'workspace', label: 'Рабочее место' },
  { code: 'safe', label: 'Сейф' },
  { code: 'hair_dryer', label: 'Фен' },
  { code: 'iron', label: 'Утюг' },
  { code: 'kettle', label: 'Чайник' },
  { code: 'terrace', label: 'Терраса' },
  { code: 'pool', label: 'Бассейн' },
  { code: 'gym', label: 'Тренажёрный зал' },
  { code: 'sauna', label: 'Сауна' },
] as const;
const AMENITY_CODES: readonly string[] = PROPERTY_AMENITIES.map((a) => a.code);
const URL_MAX = 300;
const NOTE_MAX = 500;

/** Адрес сайта: без схемы значит https; только http и https, с точкой в имени узла, без логина и пробелов */
export function normalizeWebsite(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const raw = v.trim();
  if (raw === '' || /\s/.test(raw)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.username || url.password || !url.hostname.includes('.')) return null;
    return withScheme;
  } catch {
    return null;
  }
}

const LOCKED = new Set(['currency', 'timezone']);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEXT_MAX = 300;
export const CHANNEX_PROPERTY_TYPES = [
  'apart_hotel',
  'apartment',
  'boat',
  'camping',
  'capsule_hotel',
  'chalet',
  'country_house',
  'farm_stay',
  'guest_house',
  'holiday_home',
  'holiday_park',
  'homestay',
  'hostel',
  'hotel',
  'inn',
  'lodge',
  'motel',
  'resort',
  'riad',
  'ryokan',
] as const;

/**
 * Время суток «как набирают» → ЧЧ:ММ, иначе null (SET2 «Настроек объекта», DESIGN.md §14 — всегда 24 часа). Принимает
 * «14:00», «9:00», «9.30», «0900»; не принимает 12-часовую запись и «24:00». Одна функция для стойки и API.
 */
export function normalizeClockTime(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(v.trim()) ?? /^(\d{2})(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

const text = (v: unknown): string | null => {
  if (v === null) return null;
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim();
  return s === '' ? null : s;
};

/** Текст с абзацами: пробелы в строках схлопываются, переводы строк остаются */
const paragraph = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const s = v
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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
        reason:
          'Валюту и часовой пояс меняет поддержка WETOP: от них зависят деньги и границы ночей.',
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
        if (s !== null && !EMAIL.test(s))
          return { ok: false, reason: 'Почта в виде name@example.kz' };
        out.email = s;
        break;
      }
      case 'countryCode': {
        const s = text(value)?.toUpperCase() ?? null;
        if (s !== null && !/^[A-Z]{2}$/.test(s))
          return { ok: false, reason: 'Страна: двухбуквенный код, например KZ' };
        out.countryCode = s;
        break;
      }
      case 'city': {
        const s = text(value);
        if (s !== null && s.length > 100)
          return { ok: false, reason: 'Город: не длиннее 100 знаков' };
        out.city = s;
        break;
      }
      case 'channexPropertyType': {
        const s = text(value);
        if (
          s !== null &&
          !CHANNEX_PROPERTY_TYPES.includes(s as (typeof CHANNEX_PROPERTY_TYPES)[number])
        )
          return { ok: false, reason: 'Выберите тип размещения из списка' };
        out.channexPropertyType = s;
        break;
      }
      case 'checkInTime':
      case 'checkOutTime': {
        const s = normalizeClockTime(value);
        if (s === null)
          return {
            ok: false,
            reason: `Время ${key === 'checkInTime' ? 'заезда' : 'выезда'} — в виде 14:00`,
          };
        out[key] = s;
        break;
      }
      case 'description':
      case 'houseRulesNote': {
        const s = paragraph(value);
        if (s !== null && s.length > NOTE_MAX)
          return { ok: false, reason: `Не длиннее ${NOTE_MAX} знаков` };
        out[key] = s;
        break;
      }
      case 'publicName': {
        const s = text(value);
        if (s !== null && s.length > 200)
          return { ok: false, reason: 'Публичное имя: не длиннее 200 знаков' };
        out.publicName = s;
        break;
      }
      case 'website': {
        if (value === null || (typeof value === 'string' && value.trim() === '')) {
          out.website = null;
          break;
        }
        const s = normalizeWebsite(value);
        if (s === null)
          return { ok: false, reason: 'Адрес сайта в виде https://example.kz' };
        if (s.length > URL_MAX) return { ok: false, reason: `Адрес сайта не длиннее ${URL_MAX} знаков` };
        out.website = s;
        break;
      }
      case 'earlyCheckIn':
      case 'lateCheckOut':
      case 'childrenAllowed':
      case 'petsAllowed':
      case 'smokingAllowed': {
        if (typeof value !== 'boolean') return { ok: false, reason: `${key}: только да или нет` };
        out[key] = value;
        break;
      }
      case 'onsitePayment': {
        if (!ONSITE_PAYMENTS.includes(value as OnsitePayment))
          return { ok: false, reason: 'Выберите способ оплаты на месте из списка' };
        out.onsitePayment = value as OnsitePayment;
        break;
      }
      case 'cancellationRule': {
        if (!CANCELLATION_RULES.includes(value as CancellationRule))
          return { ok: false, reason: 'Выберите правило отмены из списка' };
        out.cancellationRule = value as CancellationRule;
        break;
      }
      case 'depositRule': {
        if (!DEPOSIT_RULES.includes(value as DepositRule))
          return { ok: false, reason: 'Выберите залог из списка' };
        out.depositRule = value as DepositRule;
        break;
      }
      case 'minGuestAge': {
        const n =
          typeof value === 'number'
            ? value
            : typeof value === 'string' && /^\d{1,3}$/.test(value.trim())
              ? Number(value)
              : NaN;
        if (!Number.isInteger(n) || n < 0 || n > 99)
          return { ok: false, reason: 'Минимальный возраст гостя: целое от 0 до 99' };
        out.minGuestAge = n;
        break;
      }
      case 'quietHoursFrom':
      case 'quietHoursTo': {
        if (value === null || (typeof value === 'string' && value.trim() === '')) {
          out[key] = null;
          break;
        }
        const s = normalizeClockTime(value);
        if (s === null) return { ok: false, reason: 'Тихие часы в виде 22:00' };
        out[key] = s;
        break;
      }
      case 'amenities': {
        if (!Array.isArray(value) || value.some((c) => typeof c !== 'string' || !AMENITY_CODES.includes(c)))
          return { ok: false, reason: 'Выберите удобства из списка' };
        const chosen = new Set(value as string[]);
        out.amenities = AMENITY_CODES.filter((c) => chosen.has(c));
        break;
      }
      default:
        return { ok: false, reason: `Неизвестное поле: ${key}` };
    }
  }
  const quiet = [out.quietHoursFrom, out.quietHoursTo];
  if ((out.quietHoursFrom !== undefined || out.quietHoursTo !== undefined) && (quiet[0] == null) !== (quiet[1] == null))
    return { ok: false, reason: 'Тихие часы задаются парой: с какого и до какого времени' };
  if (Object.keys(out).length === 0) return { ok: false, reason: 'Нечего сохранять' };
  return { ok: true, value: out };
}
