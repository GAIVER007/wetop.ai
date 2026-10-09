/**
 * Чистые расчёты для экрана «Номерной фонд»: динамика по периодам и занятость сегодня.
 * Новых таблиц нет: прошлое восстанавливается из дат создания мест, блокировок и журнала уборки.
 */
export type HousekeepingState = 'DIRTY' | 'CLEAN' | 'INSPECTED';

export interface TrendUnit {
  code: string;
  kind: 'ROOM' | 'BED';
  /** Дата создания места, YYYY-MM-DD */
  createdAt: string;
  housekeepingStatus: HousekeepingState;
}
export interface TrendInput {
  today: string;
  days: number;
  /** Только действующие места: дату вывода из продажи модель не хранит */
  units: TrendUnit[];
  blocks: Array<{ code: string; dateFrom: string; dateTo: string }>;
  hkEvents: Array<{ code: string; at: string; from: HousekeepingState; to: HousekeepingState }>;
}
export interface TrendValue {
  now: number;
  before: number;
  delta: number;
  /** null, когда в начале периода было 0: процент от нуля не определён */
  percent: number | null;
}
export interface InventoryTrend {
  days: number;
  from: string;
  to: string;
  metrics: Record<
    'totalUnits' | 'rooms' | 'beds' | 'onSale' | 'unavailable' | 'needsCleaning',
    TrendValue
  >;
}

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

function snapshot(input: TrendInput, date: string) {
  const existing = input.units.filter((u) => u.createdAt <= date);
  const codes = new Set(existing.map((u) => u.code));
  const blocked = new Set(
    input.blocks
      .filter((b) => codes.has(b.code) && b.dateFrom <= date && b.dateTo > date)
      .map((b) => b.code),
  );
  // конец суток даты: события этого дня уже считаются
  const cutoff = `${addDays(date, 1)}T00:00:00Z`;
  const eventsOf = new Map<string, TrendInput['hkEvents']>();
  for (const e of [...input.hkEvents].sort((a, b) => a.at.localeCompare(b.at))) {
    eventsOf.set(e.code, [...(eventsOf.get(e.code) ?? []), e]);
  }
  let dirty = 0;
  for (const u of existing) {
    const list = eventsOf.get(u.code) ?? [];
    const upTo = list.filter((e) => e.at < cutoff);
    const status = upTo.length
      ? upTo[upTo.length - 1]!.to
      : (list[0]?.from ?? u.housekeepingStatus);
    if (status === 'DIRTY') dirty++;
  }
  return {
    totalUnits: existing.length,
    rooms: existing.filter((u) => u.kind === 'ROOM').length,
    beds: existing.filter((u) => u.kind === 'BED').length,
    unavailable: blocked.size,
    onSale: existing.length - blocked.size,
    needsCleaning: dirty,
  };
}

export function computeTrend(input: TrendInput): InventoryTrend {
  const from = addDays(input.today, -input.days);
  const now = snapshot(input, input.today);
  const before = snapshot(input, from);
  const value = (key: keyof typeof now): TrendValue => {
    const delta = now[key] - before[key];
    return {
      now: now[key],
      before: before[key],
      delta,
      percent: before[key] === 0 ? null : Math.round((delta / before[key]) * 100),
    };
  };
  return {
    days: input.days,
    from,
    to: input.today,
    metrics: {
      totalUnits: value('totalUnits'),
      rooms: value('rooms'),
      beds: value('beds'),
      onSale: value('onSale'),
      unavailable: value('unavailable'),
      needsCleaning: value('needsCleaning'),
    },
  };
}

export interface OccupancyStay {
  confirmationNumber: string;
  startDate: string;
  endDate: string;
  status: string;
  guest: string;
}
export interface UnitOccupancy {
  state: 'FREE' | 'STAYING' | 'ARRIVING';
  guest: string | null;
  confirmationNumber: string | null;
  startDate: string | null;
  endDate: string | null;
}

/** Ночь [startDate, endDate): выезд сегодня место не занимает, заезд сегодня показывается отдельно */
export function classifyOccupancy(today: string, stays: OccupancyStay[]): UnitOccupancy {
  const live = stays.filter((s) => s.status !== 'CANCELLED' && s.status !== 'NO_SHOW');
  const staying = live.find((s) => s.startDate < today && s.endDate > today);
  const arriving = live.find((s) => s.startDate === today && s.endDate > today);
  const pick = staying ?? arriving;
  if (!pick) {
    return { state: 'FREE', guest: null, confirmationNumber: null, startDate: null, endDate: null };
  }
  return {
    state: staying ? 'STAYING' : 'ARRIVING',
    guest: pick.guest || null,
    confirmationNumber: pick.confirmationNumber,
    startDate: pick.startDate,
    endDate: pick.endDate,
  };
}
