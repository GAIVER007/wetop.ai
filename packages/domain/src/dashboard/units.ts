import type { DashboardFund, DashboardUnitKind } from './metrics';

/**
 * Статистика по номерам (REP3, план `plans/reports-hub-2026-10-02.md` §3): свод тех же клеток
 * шахматки, что считает сводка `/desk/dashboard`, только до единицы — поэтому итог вкладки
 * «По номерам» сходится с «Загрузкой» сводки по построению. Денег здесь нет: у проживания
 * может быть несколько мест (переселение), правило дележа — вопрос владельца (Q-251).
 */

/** Снятые с шахматки итоги одной единицы за период: клетко-ночи и заезды */
export interface UnitBoardTally {
  code: string;
  categoryCode: string;
  categoryName: string;
  kind: DashboardUnitKind;
  occupiedNights: number;
  blockedNights: number;
  arrivals: number;
}

export interface UnitStatRow extends UnitBoardTally {
  /** Загрузка единицы: занято из дней периода без закрытых ночей (ADR-155), % с одним знаком — как у сводки */
  percent: number;
}

export interface UnitStats {
  from: string;
  to: string;
  fund: DashboardFund;
  /** Дней доски за период — знаменатель загрузки каждой единицы, как у сводки */
  nights: number;
  rows: UnitStatRow[];
  totals: {
    units: number;
    unitNights: number;
    occupiedNights: number;
    blockedNights: number;
    percent: number;
    arrivals: number;
  };
  /** Проживаний без назначенного места, касающихся периода — им ночей не припишешь */
  unassignedStays: number;
}

const FUND_KIND: Record<Exclude<DashboardFund, 'all'>, DashboardUnitKind> = {
  rooms: 'ROOM',
  beds: 'BED',
};

const percent = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;

export function buildUnitStats(
  input: {
    from: string;
    to: string;
    nights: number;
    units: UnitBoardTally[];
    unassignedStays: number;
  },
  fund: DashboardFund,
): UnitStats {
  const units =
    fund === 'all' ? input.units : input.units.filter((u) => u.kind === FUND_KIND[fund]);
  const rows = units
    .map((u) => ({ ...u, percent: percent(u.occupiedNights, input.nights - u.blockedNights) }))
    .sort(
      (a, b) =>
        a.categoryName.localeCompare(b.categoryName, 'ru') || a.code.localeCompare(b.code, 'ru'),
    );
  const sum = (key: 'occupiedNights' | 'blockedNights' | 'arrivals') =>
    rows.reduce((n, r) => n + r[key], 0);
  const occupiedNights = sum('occupiedNights');
  const unitNights = rows.length * input.nights;
  return {
    from: input.from,
    to: input.to,
    fund,
    nights: input.nights,
    rows,
    totals: {
      units: rows.length,
      unitNights,
      occupiedNights,
      blockedNights: sum('blockedNights'),
      percent: percent(occupiedNights, unitNights - sum('blockedNights')),
      arrivals: sum('arrivals'),
    },
    unassignedStays: input.unassignedStays,
  };
}
