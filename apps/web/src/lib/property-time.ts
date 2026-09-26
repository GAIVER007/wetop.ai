import { PLATFORM_TIMEZONE } from '@pms/domain';

/**
 * Часы объекта на стойке (С-13, ТЗ аудита 25.09.2026): «сегодня», месяц, штамп печати и моменты событий —
 * по поясу объекта (`Property.timezone`, приходит в `/hotel/settings`), а не сдвигом на UTC+5 и не по
 * браузеру. Пояс берётся из базы часовых поясов `Intl`: сдвиг руками верен для одного объекта и переживёт
 * смену правил только случайно. На сервере часы даёт `hotelClock()` (`lib/hotel-api.ts`), в клиентских
 * компонентах — `usePropertyClock()` (`components/property-time.tsx`).
 */

/** Пока настройки объекта не пришли или API не ответил — пояс платформы, как делал заголовок главной */
export const FALLBACK_TIMEZONE = PLATFORM_TIMEZONE;

export interface PropertyClock {
  readonly timezone: string;
  /** Сегодня объекта, YYYY-MM-DD */
  today(now?: Date): string;
  /** Месяц объекта, YYYY-MM */
  month(now?: Date): string;
  /** «Сейчас» для печатных форм: дата YYYY-MM-DD и штамп «2026-09-17 13:30» */
  printed(now?: Date): { date: string; stamp: string };
  /** Момент (UTC) → день объекта YYYY-MM-DD; не дата — пустая строка */
  date(iso: string): string;
  /**
   * Момент → «17.09 10:12» (DESIGN.md §14). Сырой ISO из базы — это UTC: стойка читает «05:12» как своё
   * время и ошибается на пять часов.
   */
  moment(iso: string | null | undefined): string;
  /** Момент → «20.09 в 16:50»: время внутри фразы. Без `Date.now()` — строка одна на сервере и в браузере */
  when(iso: string | null | undefined): string;
  /** Момент → «2026-09-17 13:30»: для журналов, где важен и год */
  stamp(iso: string): string;
  /** Момент → «13:30»: день называет подзаголовок группы, а не каждая строка */
  clock(iso: string): string;
  /** Момент → «14.09.2026 09:10» */
  full(iso: string | null | undefined): string;
  /** Момент → «17.09.2026, 10:12:33»: полная запись с секундами, как `toLocaleString('ru-RU')` */
  local(iso: string | null | undefined): string;
}

/** Мусор в поясе объекта не роняет каждую страницу: показываем по поясу платформы */
function knownZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone });
    return timeZone;
  } catch {
    return FALLBACK_TIMEZONE;
  }
}

const at = (iso: string | null | undefined): number => (iso ? Date.parse(iso) : Number.NaN);

/** Форматтеры `Intl` дороги: одни часы на пояс, а не новые на каждый вызов */
const clocks = new Map<string, PropertyClock>();

export function propertyClock(timezone: string): PropertyClock {
  const known = clocks.get(timezone);
  if (known) return known;
  const timeZone = knownZone(timezone);
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const moment = new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const full = new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  // Шведская запись — это ISO-подобное «2026-09-17 13:30» без ручной склейки
  const stamp = new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const hours = new Intl.DateTimeFormat('ru-RU', { timeZone, hour: '2-digit', minute: '2-digit' });

  const clock: PropertyClock = {
    timezone: timeZone,
    today: (now = new Date()) => day.format(now),
    month: (now = new Date()) => day.format(now).slice(0, 7),
    printed: (now = new Date()) => ({ date: day.format(now), stamp: stamp.format(now) }),
    date: (iso) => {
      const t = at(iso);
      return Number.isNaN(t) ? '' : day.format(t);
    },
    moment: (iso) => {
      const t = at(iso);
      return Number.isNaN(t) ? '—' : moment.format(t).replace(',', '');
    },
    when: (iso) => {
      const m = clock.moment(iso);
      return m === '—' ? m : m.replace(' ', ' в ');
    },
    stamp: (iso) => {
      const t = at(iso);
      return Number.isNaN(t) ? '—' : stamp.format(t);
    },
    clock: (iso) => {
      const t = at(iso);
      return Number.isNaN(t) ? '—' : hours.format(t);
    },
    full: (iso) => {
      const t = at(iso);
      return Number.isNaN(t) ? '—' : full.format(t).replace(',', '');
    },
    local: (iso) => {
      const t = at(iso);
      return Number.isNaN(t) ? '—' : new Date(t).toLocaleString('ru-RU', { timeZone });
    },
  };
  clocks.set(timezone, clock);
  return clock;
}
