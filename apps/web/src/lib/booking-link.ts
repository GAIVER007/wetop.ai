/**
 * Ссылка «Свободные места» → «Новая бронь» (ADR-110, AV3): форма открывается с тем, что уже выбрано на экране
 * поиска, и ничего не вводится повторно. Правил здесь нет — только перенос выбора: цену и место проверит API.
 */

/**
 * Значение поля «Ячейка»: место назначит система. Действие формы переводит его в `autoAssign` API брони —
 * первая свободная ячейка категории на весь срок по номеру, как у канала (Q-094).
 */
export const AUTO_UNIT = '@auto';

/** Столько же размещений допускает форма брони */
const MAX_PLACEMENTS = 88;

export interface PlacementPrefill {
  category: string;
  rate: string;
  /** Гостей в одном проживании: номер — все гости запроса, койка — один */
  adults: number;
  /** Мест в размещении; больше одного — групповая бронь, ячейки назначает система */
  quantity: number;
  /** Код ячейки, `AUTO_UNIT` или пусто («назначить позже») */
  unit: string;
}

export function bookingHref(p: {
  arrival: string;
  departure: string;
  category?: string | undefined;
  /** Тариф минимальной цены «от» (AV2); нет — форма предложит первый */
  rate?: string | undefined;
  adults?: number | undefined;
  /** Выбранные на экране места, по размещению на каждое */
  units?: readonly string[] | undefined;
  /** Сколько ещё мест назначит система */
  auto?: number | undefined;
}): string {
  // места — сразу за датами, как в ссылке шахматки `?arrival&departure&unit`
  const q = new URLSearchParams({ arrival: p.arrival, departure: p.departure });
  for (const unit of p.units ?? []) q.append('unit', unit);
  if (p.category) q.set('category', p.category);
  if (p.rate) q.set('rate', p.rate);
  if (p.adults) q.set('adults', String(p.adults));
  if (p.auto) q.set('auto', String(p.auto));
  return `/reservations/new?${q}`;
}

const count = (raw: string | undefined, max: number) =>
  raw && /^\d+$/.test(raw) && Number(raw) >= 1 && Number(raw) <= max ? Number(raw) : null;

/**
 * Размещения формы из адресной строки. Старая ссылка шахматки `?unit=` даёт одно размещение в категории этой
 * ячейки, как раньше; пустой список — форма по умолчанию.
 */
export function bookingPrefill(
  q: Record<string, string | string[] | undefined>,
  categoryOfUnit: (code: string) => string | undefined,
): PlacementPrefill[] {
  const values = (key: string) => {
    const v = q[key];
    return (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);
  };
  const category = values('category')[0] ?? '';
  const rate = values('rate')[0] ?? '';
  const adults = count(values('adults')[0], 99) ?? 1;
  const auto = category ? (count(values('auto')[0], MAX_PLACEMENTS) ?? 0) : 0;
  const placements: PlacementPrefill[] = [...new Set(values('unit'))].map((unit) => ({
    category: category || categoryOfUnit(unit) || '',
    rate,
    adults,
    quantity: 1,
    unit,
  }));
  if (auto)
    placements.push({
      category,
      rate,
      adults,
      quantity: auto,
      unit: auto > 1 ? '' : AUTO_UNIT,
    });
  if (!placements.length && category)
    placements.push({ category, rate, adults, quantity: 1, unit: '' });
  return placements.slice(0, MAX_PLACEMENTS);
}
