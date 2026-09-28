import { blockTypeLabel } from '../../lib/block-types';
import { displayDate } from '../../lib/display-date';
import { formatMoney } from '../../lib/money';
import { pluralRu } from '../../lib/plural';

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Calendar dates only. Dropping on a day includes that night; departure is the following day. */
export function extensionNights(lastNight: string, targetNight: string): number {
  const ordinal = (date: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NaN;
    const value = Date.parse(`${date}T12:00:00Z`);
    return Number.isFinite(value) && new Date(value).toISOString().slice(0, 10) === date
      ? value / 86_400_000
      : NaN;
  };
  const nights = ordinal(targetNight) - ordinal(lastNight);
  return Number.isInteger(nights) && nights > 0 && nights <= 30 ? nights : 0;
}

/**
 * Первая новая ночь, которую нельзя взять: чужая бронь или блокировка в той же строке (ТЗ v2 §29 —
 * поверх другой Allocation визуально не продлевать, конфликт показывать до отпускания). Видно только
 * то, что в окне; ночи за краем проверяет предпросмотр продления API и сама команда.
 */
export function extensionConflict(
  cells: ReadonlyArray<{
    date: string;
    state: string;
    itemId?: string | null | undefined;
    blockType?: string | null | undefined;
  }>,
  lastNight: string,
  nights: number,
  itemId: string,
): string | null {
  const until = addDays(lastNight, nights);
  for (const cell of cells) {
    if (cell.date <= lastNight || cell.date > until) continue;
    if (cell.state === 'BLOCKED')
      return `Недоступно с ${displayDate(cell.date)}: ${blockTypeLabel(cell.blockType)}`;
    if (cell.state === 'OCCUPIED' && cell.itemId !== itemId)
      return `Занято с ${displayDate(cell.date)}`;
  }
  return null;
}

/**
 * Подпись во время продления (ТЗ v2 §29): «До 27 сент., +3 ночи, +75 000 ₸». «До» — дата выезда.
 * Сумма — из предпросмотра API; пока он не ответил, её нет, а не «примерно».
 */
export function extendLabel(
  lastNight: string,
  nights: number,
  price: { addedMinor: string; currency: string } | undefined,
): string {
  const head = `До ${displayDate(addDays(lastNight, nights + 1))}, +${pluralRu(nights, ['ночь', 'ночи', 'ночей'])}`;
  return price ? `${head}, +${formatMoney(price.addedMinor, price.currency)}` : head;
}
