/**
 * «Требуют решения» на Главной владельца (решение 21.10.2026, docs/decisions/2026-10-21-owner-home-attention.md):
 * короткие строки о делах СЕГОДНЯ по поясу филиала, не о выбранном периоде. Числа считает API из своих таблиц,
 * здесь только слова, ссылки, порядок (предупреждения первыми) и предел в 4 строки, чтобы экран не листался.
 */
export type AttentionTone = 'warn' | 'ok';
export interface OwnerAttentionItem {
  id: string;
  tone: AttentionTone;
  text: string;
  href: string;
  action: string;
  count?: number;
  /** данные строки для экрана на другом языке (01.11.2026): текст выше русский */
  detail?: { since?: string; dirty?: number; beds?: boolean; clean?: boolean };
}
/** null = сигнал не прочитан (нет данных или источник недоступен): строку не показываем и «всё хорошо» не обещаем */
export interface OwnerAttentionFacts {
  vertical: string;
  /** день филиала YYYY-MM-DD, для ссылки на отбор броней */
  today?: string;
  unpaidDone?: number | null;
  freeMasters?: number | null;
  lowStock?: number | null;
  staleOrders?: number | null;
  arrivals?: number | null;
  dirtyRooms?: number | null;
  /** среди неубранных есть койко-места: тогда говорим «мест», а не «номеров» */
  dirtyHasBeds?: boolean;
  noPrepay?: number | null;
  /** касса филиала: смена открыта не сегодня, дата открытия YYYY-MM-DD (владелец 29.10.2026) */
  openShiftSince?: string | null;
  /** салон: записи, время которых прошло больше 15 минут, а «Пришла» не нажата */
  lateUnmarked?: number | null;
  /** салон: записи на завтра в статусе «Записан», не подтверждены */
  unconfirmedTomorrow?: number | null;
  extra?: OwnerAttentionItem[];
}

export const OWNER_ATTENTION_LIMIT = 4;
/** Окно у мастера, которое стоит заполнить: не меньше 2 часов подряд до конца смены */
export const FREE_WINDOW_MINUTES = 120;
/** Счёт ресторана открыт дольше 2 часов */
export const STALE_ORDER_MS = 2 * 60 * 60 * 1000;
/** Брони без предоплаты: заезд в ближайшие 7 дней */
export const PREPAY_HORIZON_DAYS = 7;

export function ruCount(n: number, forms: [string, string, string]): string {
  const d = n % 10, h = n % 100;
  const word = h >= 11 && h <= 14 ? forms[2] : d === 1 ? forms[0] : d >= 2 && d <= 4 ? forms[1] : forms[2];
  return `${n} ${word}`;
}

type Span = { from: number; to: number };
/**
 * Сколько мастеров сегодня имеют свободное окно от 2 часов. Минуты от полуночи дня филиала; прошедшее время
 * (до `nowMinutes`) окном не считается.
 */
export function freeWindowMasters(
  masters: Array<{ employeeId: string; shifts: Span[] }>,
  busy: Array<{ employeeId: string } & Span>,
  nowMinutes: number,
): number {
  let count = 0;
  for (const master of masters) {
    const taken = busy.filter((b) => b.employeeId === master.employeeId).sort((a, b) => a.from - b.from);
    const hasWindow = master.shifts.some((shift) => {
      let cursor = Math.max(shift.from, nowMinutes);
      for (const b of taken) {
        if (b.to <= cursor || b.from >= shift.to) continue;
        if (b.from - cursor >= FREE_WINDOW_MINUTES) return true;
        cursor = Math.max(cursor, b.to);
      }
      return shift.to - cursor >= FREE_WINDOW_MINUTES;
    });
    if (hasWindow) count += 1;
  }
  return count;
}

const plusDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const has = (n: number | null | undefined): n is number => typeof n === 'number' && n > 0;
const known = (n: number | null | undefined) => typeof n === 'number';

export function ownerAttention(f: OwnerAttentionFacts): OwnerAttentionItem[] {
  const items: OwnerAttentionItem[] = [];
  const stock = () => {
    if (has(f.lowStock))
      items.push({
        id: 'low-stock', tone: 'warn', count: f.lowStock,
        text: `Заканчивается: ${ruCount(f.lowStock, ['позиция', 'позиции', 'позиций'])}`,
        href: '/warehouse', action: 'Склад',
      });
  };
  const facts: Array<number | null | undefined> = [f.lowStock];
  // незакрытая вчерашняя смена: деньги кассы висят, первой строкой во всех направлениях
  if (f.openShiftSince)
    items.push({
      id: 'open-shift', tone: 'warn', detail: { since: `${f.openShiftSince.slice(8, 10)}.${f.openShiftSince.slice(5, 7)}` },
      text: `Смена с ${f.openShiftSince.slice(8, 10)}.${f.openShiftSince.slice(5, 7)} не закрыта`,
      href: f.vertical === 'FOOD_SERVICE' ? '/restaurant-finance' : '/finance', action: 'Касса',
    });
  if (f.vertical === 'BEAUTY') {
    facts.push(f.unpaidDone, f.freeMasters, f.lateUnmarked, f.unconfirmedTomorrow);
    if (has(f.lateUnmarked))
      items.push({
        id: 'late-unmarked', tone: 'warn', count: f.lateUnmarked,
        text: `Не отмечены «Пришла»: ${ruCount(f.lateUnmarked, ['запись', 'записи', 'записей'])}`,
        href: '/calendar', action: 'Журнал',
      });
    if (has(f.unpaidDone))
      items.push({
        id: 'unpaid-visits', tone: 'warn', count: f.unpaidDone,
        text: `Не оплачено сегодня: ${ruCount(f.unpaidDone, ['запись', 'записи', 'записей'])}`,
        href: '/calendar', action: 'Журнал',
      });
    if (has(f.unconfirmedTomorrow) && f.today)
      items.push({
        id: 'unconfirmed-tomorrow', tone: 'warn', count: f.unconfirmedTomorrow,
        text: `Подтвердить на завтра: ${ruCount(f.unconfirmedTomorrow, ['запись', 'записи', 'записей'])}`,
        href: `/calendar?date=${plusDays(f.today, 1)}`, action: 'Журнал',
      });
    // свободные окна это подсказка, не дело: после предупреждений и только если осталось место
    if (has(f.freeMasters))
      items.push({
        id: 'free-windows', tone: 'ok', count: f.freeMasters,
        text: `Свободные окна: ${ruCount(f.freeMasters, ['мастер', 'мастера', 'мастеров'])}`,
        href: '/calendar', action: 'Журнал',
      });
    stock();
  } else if (f.vertical === 'FOOD_SERVICE') {
    facts.push(f.staleOrders);
    if (has(f.staleOrders))
      items.push({
        id: 'stale-orders', tone: 'warn', count: f.staleOrders,
        text: `Открыты дольше 2 ч: ${ruCount(f.staleOrders, ['счёт', 'счёта', 'счетов'])}`,
        href: '/floor-plan', action: 'Зал',
      });
    stock();
  } else if (f.vertical === 'HOSPITALITY') {
    facts.push(f.arrivals, f.dirtyRooms, f.noPrepay);
    const rooms = (n: number) => (f.dirtyHasBeds ? ruCount(n, ['место', 'места', 'мест']) : ruCount(n, ['номер', 'номера', 'номеров']));
    if (has(f.arrivals)) {
      const dirty = has(f.dirtyRooms);
      items.push({
        id: 'arrivals', tone: dirty ? 'warn' : 'ok', count: f.arrivals,
        detail: dirty ? { dirty: f.dirtyRooms!, beds: Boolean(f.dirtyHasBeds) } : { clean: known(f.dirtyRooms) },
        // строка в одну линию узкой колонки: при неубранных «сегодня» опускаем, заезды и так за сегодня
        text: `${ruCount(f.arrivals, ['заезд', 'заезда', 'заездов'])}${dirty ? `, не убрано: ${rooms(f.dirtyRooms!)}` : known(f.dirtyRooms) ? ' сегодня, номера убраны' : ' сегодня'}`,
        href: dirty ? '/inventory?housekeeping=DIRTY' : '/reservations?arrival=today',
        action: dirty ? 'Номера' : 'Заезды',
      });
    } else if (has(f.dirtyRooms))
      items.push({
        id: 'dirty-rooms', tone: 'warn', count: f.dirtyRooms, detail: { dirty: f.dirtyRooms, beds: Boolean(f.dirtyHasBeds) },
        text: `Не убрано: ${rooms(f.dirtyRooms)}`, href: '/inventory?housekeeping=DIRTY', action: 'Номера',
      });
    if (has(f.noPrepay) && f.today) {
      const query = new URLSearchParams({ from: f.today, to: plusDays(f.today, PREPAY_HORIZON_DAYS), date: 'arrival', payment: 'unpaid' });
      items.push({
        id: 'no-prepayment', tone: 'warn', count: f.noPrepay,
        text: `${ruCount(f.noPrepay, ['бронь', 'брони', 'броней'])} без предоплаты`,
        href: `/reservations?${query}`, action: 'Брони',
      });
    }
    stock();
  }
  items.push(...(f.extra ?? []));
  const ordered = [...items.filter((i) => i.tone === 'warn'), ...items.filter((i) => i.tone !== 'warn')];
  if (!ordered.length) {
    // «дел нет» только если хотя бы один сигнал действительно прочитан
    return facts.some(known)
      ? [{ id: 'all-clear', tone: 'ok', text: 'Срочных дел нет', href: '/today/operations', action: 'Открыть день' }]
      : [];
  }
  return ordered.slice(0, OWNER_ATTENTION_LIMIT);
}
