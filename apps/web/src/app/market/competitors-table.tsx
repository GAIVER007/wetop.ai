import { demandLevel, formatOccupancy, formatPoints } from '@pms/domain';
import type { MarketView } from '../../lib/api';
import { displayDay } from '../../lib/display-date';
import { Badge, Table, cx } from '../../components/ui';
import { competitorStats } from './derive';
import { CompetitorButton, OccupancyButton } from './drawers';

const STATUS = {
  high: { word: 'Высокий спрос', tone: 'ok' as const },
  mid: { word: 'Обычный спрос', tone: 'neutral' as const },
  low: { word: 'Слабый спрос', tone: 'warn' as const },
};

/**
 * Таблица конкурентов (COMP3.2, ТЗ §8): объект, расстояние, средняя загрузка за окно, динамика
 * к сравнению, статус словом и датой последних данных; действия строки здесь, а не в «По ночам».
 * На телефоне строка складывается в карточку (приём .fund-cat-table, DESIGN.md §8).
 */
export function CompetitorsTable({ view, editable }: { view: MarketView; editable: boolean }) {
  const byId = new Map(view.competitors.map((c) => [c.id, c]));
  return (
    <Table
      size="sm"
      density="normal"
      className="market-comp-table"
      aria-label="Конкуренты: загрузка за период, динамика и статус"
      data-testid="market-competitors"
    >
      <thead>
        <tr>
          <th scope="col">Объект</th>
          <th scope="col">Расстояние</th>
          <th scope="col">Загрузка за период</th>
          <th scope="col">Динамика</th>
          <th scope="col">Статус</th>
          <th scope="col">Данные от</th>
          {editable && (
            <th scope="col">
              <span className="sr-only">Действия</span>
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {view.board.competitors.map((c) => {
          const full = byId.get(c.id);
          const s = competitorStats(c.cells);
          const level = demandLevel(s.avgBp);
          return (
            <tr key={c.id} data-testid={`market-comp-${c.id}`}>
              <th scope="row" className="market-comp-name">
                <span className="market-name">
                  {c.url ? (
                    <a href={c.url} target="_blank" rel="noreferrer noopener">
                      {c.name}
                    </a>
                  ) : (
                    c.name
                  )}
                  {c.sources.includes('AI_AGENT') && <Badge tone="info">ИИ</Badge>}
                </span>
                {c.unitsTotal !== null && <span className="market-sub">{c.unitsTotal} мест</span>}
              </th>
              <td className="market-comp-dist">{c.distanceM !== null ? `${c.distanceM} м` : '–'}</td>
              <td className="market-comp-avg">
                {s.avgBp === null ? '–' : formatOccupancy(Math.round(s.avgBp / 100) * 100)}
              </td>
              <td className="market-comp-delta">
                {s.avgDeltaBp === null || Math.round(s.avgDeltaBp / 100) === 0 ? (
                  '–'
                ) : (
                  <span className={cx(s.avgDeltaBp > 0 ? 'is-up' : 'is-down')}>
                    {formatPoints(Math.round(s.avgDeltaBp / 100) * 100)}
                  </span>
                )}
              </td>
              <td className="market-comp-status">
                {level === null ? (
                  <span className="market-nodata">Недостаточно данных</span>
                ) : (
                  <Badge tone={STATUS[level].tone}>{STATUS[level].word}</Badge>
                )}
              </td>
              <td className="market-comp-seen">
                {c.lastObservedOn ? displayDay(c.lastObservedOn) : 'данных нет'}
              </td>
              {editable && (
                <td className="market-comp-actions">
                  {full && (
                    <span className="market-row-actions">
                      <OccupancyButton competitor={{ id: c.id, name: c.name }} cells={c.cells} />
                      <CompetitorButton competitor={full} />
                    </span>
                  )}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
