/**
 * День переезда, ADR-024 (Q-109): при подключении Booking.com, Expedia и Trip.com Channex присылает
 * их старые брони как новые. PMS связывает такую ревизию с уже перенесённой из Exely бронью по каналу
 * и составу проживаний — но если перенесённых броней с одинаковым составом несколько, выбирать за
 * человека она не будет и отклонит ревизию. Здесь — заранее посчитанный список таких групп.
 *
 * Чистая часть без базы: группировка и подсказка, чем группу можно различить.
 */

export interface AmbiguousRow {
  confirmationNumber: string;
  channel: string | null;
  /** Проживания: категория и даты — то, по чему PMS ищет совпадение */
  stays: Array<{ category: string; arrival: string; departure: string }>;
  /** Ячейки, назначенные при переносе из Exely: их надо сохранить за той же бронью */
  units: string[];
  totalAmountMinor: bigint;
  /** Оплачено на счёте (перенос из Exely): если канал пришлёт предоплату, второй раз она не пишется */
  paidMinor: bigint;
}

export interface AmbiguousGroup {
  channel: string;
  composition: string;
  rows: AmbiguousRow[];
  /** Все суммы в группе разные — ревизию канала можно опознать по сумме, не дожидаясь имени гостя */
  byAmount: boolean;
}

/** Разделитель ключа: в названиях каналов и категорий вертикальной черты нет. */
const SEP = ' :: ';

export const composition = (stays: AmbiguousRow['stays']): string =>
  stays
    .map((s) => `${s.category}: ${s.arrival} → ${s.departure}`)
    .sort()
    .join(' + ');

/** Группы, где перенесённых броней с одинаковым каналом и составом больше одной. */
export function groupAmbiguous(rows: AmbiguousRow[]): AmbiguousGroup[] {
  const byKey = new Map<string, AmbiguousRow[]>();
  for (const r of rows) {
    if (r.stays.length === 0) continue;
    const key = `${r.channel ?? '—'}${SEP}${composition(r.stays)}`;
    byKey.set(key, [...(byKey.get(key) ?? []), r]);
  }
  return [...byKey]
    .filter(([, g]) => g.length > 1)
    .map(([key, g]) => {
      const at = key.indexOf(SEP);
      const channel = key.slice(0, at);
      const comp = key.slice(at + SEP.length);
      const amounts = new Set(g.map((r) => r.totalAmountMinor.toString()));
      return { channel, composition: comp, rows: g, byAmount: amounts.size === g.length };
    })
    .sort(
      (a, b) =>
        b.rows.length - a.rows.length ||
        a.channel.localeCompare(b.channel) ||
        a.composition.localeCompare(b.composition),
    );
}

export const money = (m: bigint): string => {
  const d = (m < 0n ? -m : m).toString().padStart(3, '0');
  return `${m < 0n ? '−' : ''}${d.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${d.slice(-2)} ₸`;
};
