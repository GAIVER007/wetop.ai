import { SITE_KEY_RE } from '../web-analytics/hit';

/**
 * Заявка с управляемого сайта (SITE-2, `docs/marketing/site-leads-v0.md`, ADR-185 п. 3). Форма `leadForm` рантайма
 * `apps/sites` отправляет из браузера посетителя JSON на публичный адрес API своего режима. Здесь только контракт тела
 * и его разбор без базы: приём, Turnstile, лимиты, повтор по ключу запроса и запись в календарь делают публичные
 * адреса API (`/w/book` уже есть; `/w/beauty/book`, `/w/food/reserve`, `/w/lead` вводят срезы SITE-4 и SITE-5).
 *
 * Салон отправляет serviceId и точный ISO startsAt с поясом из `/w/beauty/slots` (актуальный публичный разбор:
 * `web-booking/site-forms.ts`). Ресторан сохраняет дату и время филиала (`YYYY-MM-DD` и `HH:mm`).
 */
export const SITE_LEAD_SCHEMA_VERSION = 'site-lead/0' as const;

// Файл без зависимостей кроме `hit.ts` (тоже без импортов): его импортирует Worker `apps/sites` напрямую, как `host.ts`

/**
 * Режим формы заявки (`leadForm`): куда браузер посетителя отправит форму. Гостиница бронирует номер (`/w/book`,
 * существует), салон записывает к мастеру (`/w/beauty/book`), ресторан бронирует стол (`/w/food/reserve`), любой сайт
 * может принять «перезвоните мне» (`/w/lead`).
 */
export const SITE_LEAD_MODES = ['HOTEL_BOOKING', 'BEAUTY_APPOINTMENT', 'TABLE_RESERVATION', 'CALLBACK'] as const;
export type SiteLeadMode = (typeof SITE_LEAD_MODES)[number];
export const SITE_LEAD_MODES_BY_VERTICAL: Readonly<Record<'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE', readonly SiteLeadMode[]>> = Object.freeze({
  HOSPITALITY: ['HOTEL_BOOKING', 'CALLBACK'],
  BEAUTY: ['BEAUTY_APPOINTMENT', 'CALLBACK'],
  FOOD_SERVICE: ['TABLE_RESERVATION', 'CALLBACK'],
});

/** Куда отправляет форма каждого режима: путь от адреса публичного API */
export const SITE_LEAD_ENDPOINTS: Readonly<Record<SiteLeadMode, string>> = Object.freeze({
  HOTEL_BOOKING: '/w/book',
  BEAUTY_APPOINTMENT: '/w/beauty/book',
  TABLE_RESERVATION: '/w/food/reserve',
  CALLBACK: '/w/lead',
});

export const SITE_LEAD_LIMITS = Object.freeze({
  name: 120,
  comment: 1000,
  partySizeMax: 50,
  turnstileToken: 2048,
});

/** Общие поля любой заявки, кроме брони номера (у неё прежнее тело `/w/book`, его ведёт виджет) */
export interface SiteLeadCommon {
  /** Публичный ключ сайта счётчика (`pms_` и 12 знаков), как `k` у `/w/book`: по нему API находит филиал */
  k: string;
  name: string;
  /** Телефон как ввёл посетитель; API приводит к E.164 и отказывает, если не вышло */
  phone: string;
  comment?: string;
  /** Ключ запроса (UUID v4): повтор того же ключа не создаёт вторую запись */
  requestKey: string;
  /** Токен Turnstile; обязателен, когда проверка включена (`GET /w/config` отдаёт ключ) */
  turnstileToken?: string;
  /** Ловушка для ботов: человек поле не видит, непустое значение API принимает молча и не записывает */
  website?: string;
  /** Язык страницы сайта, для ответа и уведомления */
  lang?: 'ru' | 'kk' | 'en';
}

export interface BeautyAppointmentLead extends SiteLeadCommon {
  mode: 'BEAUTY_APPOINTMENT';
  /** UUID услуги WETOP: в SiteSpec хранится в services.items[].serviceCode, на проводе serviceId */
  serviceId: string;
  /** Мастер из секции `staff`; нет поля: «любой мастер» */
  employeeId?: string;
  /** Точный ISO startsAt из `/w/beauty/slots`, с Z или явным смещением */
  startsAt: string;
}

export interface TableReservationLead extends SiteLeadCommon {
  mode: 'TABLE_RESERVATION';
  /** Дата по календарю филиала `YYYY-MM-DD` */
  date: string;
  /** Время по часам филиала `HH:mm` */
  time: string;
  partySize: number;
}

export interface CallbackLead extends SiteLeadCommon {
  mode: 'CALLBACK';
}

export type SiteLeadBody = BeautyAppointmentLead | TableReservationLead | CallbackLead;

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0008\u000b-\u001f\u007f]/;

function validDate(raw: string): boolean {
  const m = DATE_RE.exec(raw);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

export type SiteLeadParse = { ok: true; body: SiteLeadBody } | { ok: false; errors: string[] };

/**
 * Строгий разбор тела заявки салона, ресторана или «перезвоните»: лишнее поле, неверный формат или пустое
 * обязательное поле дают отказ со списком полей. Режим задаёт адрес (`mode` из пути), а не тело: тело своего режима
 * не может прикинуться другим. Бронь номера сюда не входит: у неё прежний разбор `/w/book`.
 */
export function parseSiteLead(mode: Exclude<SiteLeadMode, 'HOTEL_BOOKING'>, raw: unknown): SiteLeadParse {
  const errors: string[] = [];
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['body'] };
  const r = raw as Record<string, unknown>;
  const specific: Record<typeof mode, string[]> = {
    BEAUTY_APPOINTMENT: ['serviceId', 'employeeId', 'startsAt'],
    TABLE_RESERVATION: ['date', 'time', 'partySize'],
    CALLBACK: [],
  };
  const allowed = ['k', 'name', 'phone', 'comment', 'requestKey', 'turnstileToken', 'website', 'lang', ...specific[mode]];
  for (const key of Object.keys(r)) if (!allowed.includes(key)) errors.push(key);
  const text = (key: string, max: number, required: boolean): string | undefined => {
    const v = r[key];
    if (v === undefined || v === null || v === '') {
      if (required) errors.push(key);
      return undefined;
    }
    if (typeof v !== 'string') {
      errors.push(key);
      return undefined;
    }
    const t = v.replace(/\r\n?/g, '\n').trim();
    if ((required && !t) || [...t].length > max || CONTROL_RE.test(t)) errors.push(key);
    return t || undefined;
  };
  const k = typeof r['k'] === 'string' && SITE_KEY_RE.test(r['k']) ? r['k'] : (errors.push('k'), '');
  const name = text('name', mode === 'BEAUTY_APPOINTMENT' ? 100 : SITE_LEAD_LIMITS.name, true) ?? '';
  const phoneRaw = text('phone', 32, true) ?? '';
  if (phoneRaw && !/^\+?[0-9 ()-]{7,32}$/.test(phoneRaw)) errors.push('phone');
  const comment = text('comment', SITE_LEAD_LIMITS.comment, false);
  const requestKey = typeof r['requestKey'] === 'string' && UUID_V4_RE.test(r['requestKey']) ? r['requestKey'].toLowerCase() : (errors.push('requestKey'), '');
  const turnstileToken = text('turnstileToken', SITE_LEAD_LIMITS.turnstileToken, false);
  const website = typeof r['website'] === 'string' ? r['website'] : undefined;
  if (r['website'] !== undefined && typeof r['website'] !== 'string') errors.push('website');
  const lang = r['lang'];
  if (lang !== undefined && lang !== 'ru' && lang !== 'kk' && lang !== 'en') errors.push('lang');
  const common: SiteLeadCommon = {
    k,
    name,
    phone: phoneRaw,
    requestKey,
    ...(comment ? { comment } : {}),
    ...(turnstileToken ? { turnstileToken } : {}),
    ...(website !== undefined ? { website } : {}),
    ...(lang ? { lang: lang as 'ru' | 'kk' | 'en' } : {}),
  };
  let body: SiteLeadBody;
  if (mode === 'BEAUTY_APPOINTMENT') {
    const serviceId = typeof r['serviceId'] === 'string' && UUID_RE.test(r['serviceId']) ? r['serviceId'] : (errors.push('serviceId'), '');
    const employee = r['employeeId'];
    if (employee !== undefined && employee !== '' && (typeof employee !== 'string' || !UUID_RE.test(employee))) errors.push('employeeId');
    const startsAt = typeof r['startsAt'] === 'string' ? r['startsAt'] : '';
    if (!INSTANT_RE.test(startsAt) || Number.isNaN(Date.parse(startsAt))) errors.push('startsAt');
    body = {
      ...common,
      mode,
      serviceId,
      startsAt,
      ...(typeof employee === 'string' && employee ? { employeeId: employee.toLowerCase() } : {}),
    };
  } else if (mode === 'TABLE_RESERVATION') {
    const date = typeof r['date'] === 'string' && validDate(r['date']) ? r['date'] : (errors.push('date'), '');
    const time = typeof r['time'] === 'string' && TIME_RE.test(r['time']) ? r['time'] : (errors.push('time'), '');
    const party = r['partySize'];
    const partySize =
      typeof party === 'number' && Number.isInteger(party) && party >= 1 && party <= SITE_LEAD_LIMITS.partySizeMax ? party : (errors.push('partySize'), 0);
    body = { ...common, mode, date, time, partySize };
  } else body = { ...common, mode };
  return errors.length ? { ok: false, errors: [...new Set(errors)] } : { ok: true, body };
}
