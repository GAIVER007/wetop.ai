import type { ReactNode } from 'react';
import type { DashboardPeriod } from '@pms/domain';
import { formatPercent } from '../../../lib/dashboard-format';
import { occupancyByKind, type KindOccupancy } from '../../../lib/occupancy-kinds';
import { Tile, pointsDelta } from './tiles';

/**
 * Плитки загрузки (ADR-155, Q-287): при «Всех» с номерами и койками в фонде это две плитки, у каждой свой знаменатель и
 * своё сравнение, общего процента нет. Первая плитка сохраняет `data-testid` и класс прежней «Загрузки». В одном типе
 * фонда или с фондом из одного типа плитка одна, как была.
 */
export function OccupancyTiles({
  c,
  p,
  hint,
}: {
  c: DashboardPeriod;
  p: DashboardPeriod | null;
  hint: (o: { occupiedNights: number; sellableNights: number; blockedNights: number }) => ReactNode;
}) {
  const compare = p !== null;
  const prev = p ?? c;
  if (c.fund === 'all' && c.funds.rooms > 0 && c.funds.beds > 0) {
    const now = occupancyByKind(c.categories);
    const before = occupancyByKind(prev.categories);
    const tile = (id: string, label: string, a: KindOccupancy | null, b: KindOccupancy | null) =>
      a && (
        <Tile
          id={id}
          label={label}
          value={formatPercent(a.percent)}
          hint={hint(a)}
          delta={pointsDelta(a.percent, b?.percent ?? 0, b?.occupiedNights ?? 0)}
          compare={compare}
        />
      );
    return (
      <>
        {tile('occupancy', 'Загрузка номеров', now.rooms, before.rooms)}
        {tile('occupancy-beds', 'Загрузка коек', now.beds, before.beds)}
      </>
    );
  }
  return (
    <Tile
      id="occupancy"
      label="Загрузка"
      value={formatPercent(c.occupancy.percent)}
      hint={hint(c.occupancy)}
      delta={pointsDelta(
        c.occupancy.percent,
        prev.occupancy.percent,
        prev.occupancy.occupiedNights,
      )}
      compare={compare}
    />
  );
}
