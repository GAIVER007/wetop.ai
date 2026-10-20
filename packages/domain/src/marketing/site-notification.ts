/**
 * Сообщение сотруднику о брони или заявке с сайта WETOP (план `plans/staff-telegram-notifications-2026-10-20.md`).
 * Чистая функция: текст собирается при отправке из самой брони, в очереди уведомлений его нет (персональные данные
 * гостя не копируются, ADR-018). Деньги в минимальных единицах строкой, без float; время записи в часовом поясе
 * филиала. Telegram получает простой текст (без разметки), поэтому экранировать нечего.
 */
interface Money {
  minor: string;
  currency: string;
}
interface Common {
  locationName: string;
  guestName: string | null;
  guestPhone: string | null;
  /** Карточка в WETOP: бронь, запись или заявка */
  link: string;
  /** Часовой пояс филиала (IANA) */
  timezone: string;
}
export type StaffSiteEvent = Common &
  (
    | {
        kind: 'SITE_BOOKING_HOTEL';
        confirmationNumber: string;
        categoryName: string;
        arrivalDate: string;
        departureDate: string;
        adults: number;
        total: Money | null;
      }
    | { kind: 'SITE_APPOINTMENT'; serviceName: string; employeeName: string | null; startsAt: string; price: Money | null }
    | { kind: 'SITE_TABLE'; startsAt: string; partySize: number; comment?: string | null }
    | { kind: 'SITE_LEAD'; comment?: string | null }
  );

export interface StaffMessage {
  text: string;
  button: { text: string; url: string };
}

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const CURRENCY: Record<string, string> = { KZT: '₸', RUB: '₽', USD: '$', EUR: '€', UZS: 'сум', KGS: 'сом' };

function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}

/** Сумма из минимальных единиц строкой: целая часть с пробелами-разрядами, копейки только если есть */
function money(m: Money | null | undefined): string | null {
  if (!m || !/^\d{1,18}$/.test(m.minor)) return null;
  const minor = m.minor.padStart(3, '0');
  const whole = minor.slice(0, -2).replace(/^0+(?=\d)/, '');
  const cents = minor.slice(-2);
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  return `${grouped}${cents === '00' ? '' : `,${cents}`} ${CURRENCY[m.currency] ?? m.currency}`;
}

/** +77010000001 → +7 701 000 00 01; другое как есть */
function phone(raw: string | null): string | null {
  if (!raw) return null;
  const d = raw.replace(/[^\d+]/g, '');
  const m = /^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(d);
  return m ? `+7 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : raw.trim();
}

const clip = (s: string | null | undefined, max: number) => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

/** Дата брони гостиницы (DATE без времени) → «21 окт» */
const day = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number);
  return { d: d!, m: m! - 1 };
};
function stayRange(a: string, b: string): string {
  const x = day(a);
  const y = day(b);
  return x.m === y.m ? `${x.d}–${y.d} ${MONTHS[y.m]}` : `${x.d} ${MONTHS[x.m]} – ${y.d} ${MONTHS[y.m]}`;
}
const nights = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** Момент записи (UTC) → «пт, 24 окт, 15:00» в часовом поясе филиала */
function when(iso: string, timezone: string): string {
  const date = new Date(iso);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('ru-RU', { timeZone: timezone, weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts['weekday']}, ${parts['day']} ${MONTHS[Number(parts['month']) - 1]}, ${parts['hour']}:${parts['minute']}`;
}

export function staffNotificationText(e: StaffSiteEvent): StaffMessage {
  const lines: string[] = [];
  const guest = [clip(e.guestName, 80), phone(e.guestPhone)].filter(Boolean).join(', ');
  switch (e.kind) {
    case 'SITE_BOOKING_HOTEL': {
      const n = nights(e.arrivalDate, e.departureDate);
      lines.push(`🛎 Новая бронь с сайта №${clip(e.confirmationNumber, 20)}`);
      lines.push(`${clip(e.categoryName, 80)}`);
      lines.push(`${stayRange(e.arrivalDate, e.departureDate)} (${n} ${plural(n, 'ночь', 'ночи', 'ночей')}), ${e.adults} ${plural(e.adults, 'гость', 'гостя', 'гостей')}`);
      const sum = money(e.total);
      if (sum) lines.push(`Сумма: ${sum}`);
      break;
    }
    case 'SITE_APPOINTMENT': {
      lines.push('💅 Новая запись с сайта');
      lines.push(clip(e.serviceName, 120));
      lines.push(`Мастер: ${e.employeeName ? clip(e.employeeName, 80) : 'любой'}`);
      lines.push(when(e.startsAt, e.timezone));
      const sum = money(e.price);
      if (sum) lines.push(`Цена: ${sum}`);
      break;
    }
    case 'SITE_TABLE': {
      lines.push('🍽 Бронь стола с сайта');
      lines.push(`${when(e.startsAt, e.timezone)}, ${e.partySize} ${plural(e.partySize, 'гость', 'гостя', 'гостей')}`);
      if (e.comment?.trim()) lines.push(`Комментарий: ${clip(e.comment, 500)}`);
      break;
    }
    case 'SITE_LEAD': {
      lines.push('📩 Заявка с сайта: перезвоните');
      if (e.comment?.trim()) lines.push(`Комментарий: ${clip(e.comment, 500)}`);
      break;
    }
  }
  if (guest) lines.push(`Гость: ${guest}`);
  lines.push(clip(e.locationName, 80));
  return { text: lines.filter(Boolean).join('\n'), button: { text: 'Открыть в WETOP', url: e.link } };
}
