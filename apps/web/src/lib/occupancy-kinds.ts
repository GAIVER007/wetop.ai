import type { DashboardCategory } from '@pms/domain';

export interface KindOccupancy {
  unitNights: number;
  occupiedNights: number;
  blockedNights: number;
  /** Доступно к продаже: ночи минус закрытые (ADR-155) */
  sellableNights: number;
  percent: number;
}

/**
 * Загрузка номеров и коек порознь (ADR-155, Q-287, `docs/metrics.md` §1): при «Всех» общего процента нет, номер и койка
 * в один знаменатель не складываются. Из категорий сводки; типа нет в фонде, его значение `null`.
 */
export function occupancyByKind(
  categories: Array<
    Pick<DashboardCategory, 'kind' | 'unitNights' | 'occupiedNights' | 'blockedNights'>
  >,
): { rooms: KindOccupancy | null; beds: KindOccupancy | null } {
  const of = (kind: 'ROOM' | 'BED'): KindOccupancy | null => {
    const rows = categories.filter((c) => c.kind === kind);
    if (rows.length === 0) return null;
    const unitNights = rows.reduce((n, c) => n + c.unitNights, 0);
    const occupiedNights = rows.reduce((n, c) => n + c.occupiedNights, 0);
    const blockedNights = rows.reduce((n, c) => n + c.blockedNights, 0);
    const sellableNights = unitNights - blockedNights;
    return {
      unitNights,
      occupiedNights,
      blockedNights,
      sellableNights,
      percent: sellableNights > 0 ? Math.round((occupiedNights * 1000) / sellableNights) / 10 : 0,
    };
  };
  return { rooms: of('ROOM'), beds: of('BED') };
}
