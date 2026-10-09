import { formatOccupancy, formatPoints } from '@pms/domain';
import type { MarketView } from '../../lib/api';
import { displayDate } from '../../lib/display-date';
import { SectionTitle } from '../../components/ui';
import { buildChartRows, linePath, type ChartRow } from './chart-data';

/**
 * Три графика экрана «Загрузка конкурентов» (SALES2.3), чистый SVG без клиентского кода: токены `--chart-*`, подсказка
 * на каждой точке (`<title>`), таблица значений в `<details>` для читалок и клавиатуры. Цен у конкурентов нет
 * (ADR-142), поэтому графики про загрузку, наличие внесённых данных и изменение к прошлому снимку. Линии различаются
 * штрихом и подписью, а не только цветом: цветов у графиков два.
 */
const W = 720;
const H = 168;
const PAD = { l: 64, r: 8, t: 12, b: 24 };
const PLOT = { w: W - PAD.l - PAD.r, h: H - PAD.t - PAD.b };

const pct = (bp: number | null) => (bp === null ? 'нет данных' : formatOccupancy(Math.round(bp / 100) * 100));

function Frame({
  title,
  note,
  children,
  rows,
  testId,
  columns,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
  rows: ChartRow[];
  testId: string;
  columns: Array<{ head: string; cell: (r: ChartRow) => string }>;
}) {
  return (
    <figure className="market-chart" data-testid={testId}>
      <figcaption>
        <SectionTitle first>{title}</SectionTitle>
        {note && <p className="market-chart__note">{note}</p>}
      </figcaption>
      <div className="market-chart__scroll" tabIndex={0} role="group" aria-label={`${title}: график, прокручивается на узком экране`}>
        {children}
      </div>
      <details className="market-chart__table">
        <summary>Значения по ночам</summary>
        <table className="table table--sm">
          <thead>
            <tr>
              <th scope="col">Ночь</th>
              {columns.map((c) => (
                <th scope="col" key={c.head}>
                  {c.head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.date}>
                <th scope="row">{displayDate(r.date)}</th>
                {columns.map((c) => (
                  <td key={c.head}>{c.cell(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function Axes({ rows, ticks }: { rows: ChartRow[]; ticks: Array<{ y: number; label: string }> }) {
  const every = rows.length > 20 ? 5 : rows.length > 10 ? 2 : 1;
  const band = PLOT.w / Math.max(rows.length, 1);
  return (
    <>
      {ticks.map((t) => (
        <g key={t.label}>
          <line x1={PAD.l} x2={W - PAD.r} y1={t.y} y2={t.y} stroke="var(--grid-line)" strokeWidth={1} />
          <text x={PAD.l - 6} y={t.y + 4} textAnchor="end" fontSize={13} fill="var(--muted-2)">
            {t.label}
          </text>
        </g>
      ))}
      {rows.map((r, i) =>
        i % every === 0 ? (
          <text key={r.date} x={PAD.l + i * band + band / 2} y={H - 6} textAnchor="middle" fontSize={13} fill="var(--muted-2)">
            {Number(r.date.slice(8, 10))}
          </text>
        ) : null,
      )}
    </>
  );
}

export function MarketCharts({ board }: { board: MarketView['board'] }) {
  const rows = buildChartRows(board);
  const n = Math.max(rows.length, 1);
  const band = PLOT.w / n;
  const x = (i: number) => Math.round(PAD.l + i * band + band / 2);
  const yPct = (bp: number) => Math.round(PAD.t + PLOT.h - (Math.min(bp, 10000) / 10000) * PLOT.h);
  const ticksPct = [0, 5000, 10000].map((bp) => ({ y: yPct(bp), label: formatOccupancy(bp) }));
  const series = [
    { key: 'max', label: 'Самый загруженный сосед', stroke: 'var(--muted-2)', dash: '2 4', width: 1.5 },
    { key: 'min', label: 'Самый свободный сосед', stroke: 'var(--muted-2)', dash: '8 4', width: 1.5 },
    { key: 'market', label: 'Рынок (среднее)', stroke: 'var(--chart-2)', dash: undefined, width: 2.5 },
    { key: 'own', label: 'Вы', stroke: 'var(--chart-1)', dash: undefined, width: 3 },
  ] as const;

  // третий график: среднее изменение к прошлому снимку вокруг нуля
  const maxChange = Math.max(500, ...rows.map((r) => Math.abs(r.changeBp ?? 0)));
  const yChange = (bp: number) => Math.round(PAD.t + PLOT.h / 2 - (bp / maxChange) * (PLOT.h / 2));
  const comparing = board.compareDays > 0;
  const barW = Math.min(24, Math.max(2, band - 2));

  return (
    <section className="market-charts" aria-label="Графики" data-testid="market-charts">
      <Frame
        testId="market-chart-load"
        title="Загрузка по ночам"
        note="Ваша загрузка по календарю, рынок и два соседа-крайних по внесённым данным. Это внесённые значения, а не измеренная загрузка."
        rows={rows}
        columns={[
          { head: 'Вы', cell: (r) => pct(r.own) },
          { head: 'Рынок', cell: (r) => pct(r.market) },
          { head: 'Самый свободный', cell: (r) => pct(r.min) },
          { head: 'Самый загруженный', cell: (r) => pct(r.max) },
        ]}
      >
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Загрузка по ночам: вы, рынок и крайние соседи" className="market-chart__svg">
          <Axes rows={rows} ticks={ticksPct} />
          {series.map((s) => (
            <path
              key={s.key}
              data-series={s.key}
              d={linePath(rows.map((r) => r[s.key]), yPct, x)}
              fill="none"
              stroke={s.stroke}
              strokeWidth={s.width}
              strokeDasharray={s.dash}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {rows.map((r, i) =>
            r.own === null ? null : (
              <circle key={r.date} cx={x(i)} cy={yPct(r.own)} r={3} fill="var(--chart-1)">
                <title>{`${displayDate(r.date)}: вы ${pct(r.own)}, рынок ${pct(r.market)}`}</title>
              </circle>
            ),
          )}
        </svg>
        <ul className="market-chart__legend" aria-label="Обозначения">
          {series
            .slice()
            .reverse()
            .map((s) => (
              <li key={s.key}>
                <svg width="28" height="8" aria-hidden="true">
                  <line x1="0" x2="28" y1="4" y2="4" stroke={s.stroke} strokeWidth={s.width} strokeDasharray={s.dash} />
                </svg>
                {s.label}
              </li>
            ))}
        </ul>
      </Frame>

      <Frame
        testId="market-chart-data"
        title="Наличие данных по соседям"
        note="Сколько соседей из списка внесено на каждую ночь. Ночи без данных не значат, что отель пуст."
        rows={rows}
        columns={[{ head: 'С данными', cell: (r) => `${r.withData} из ${r.total}` }]}
      >
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Сколько соседей внесено на каждую ночь" className="market-chart__svg">
          <Axes
            rows={rows}
            ticks={[
              { y: PAD.t + PLOT.h, label: '0' },
              { y: PAD.t, label: String(rows[0]?.total ?? 0) },
            ]}
          />
          {rows.map((r, i) => {
            const total = Math.max(r.total, 1);
            const h = (r.withData / total) * PLOT.h;
            return (
              <g key={r.date}>
                <rect x={x(i) - barW / 2} y={PAD.t} width={barW} height={PLOT.h} fill="var(--chart-1-soft)" />
                <rect x={x(i) - barW / 2} y={PAD.t + PLOT.h - h} width={barW} height={h} fill="var(--chart-1)">
                  <title>{`${displayDate(r.date)}: ${r.withData} из ${r.total}`}</title>
                </rect>
              </g>
            );
          })}
        </svg>
      </Frame>

      <Frame
        testId="market-chart-change"
        title="Изменение к прошлому снимку"
        note={comparing ? 'Среднее изменение загрузки соседей, в процентных пунктах.' : 'Включите «Изменение» в строке выше: сейчас сравнения нет.'}
        rows={rows}
        columns={[{ head: 'Изменение', cell: (r) => (r.changeBp === null ? 'нет данных' : formatPoints(Math.round(r.changeBp / 100) * 100)) }]}
      >
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Среднее изменение загрузки соседей к прошлому снимку" className="market-chart__svg">
          <Axes
            rows={rows}
            ticks={[
              { y: yChange(maxChange), label: formatPoints(maxChange) },
              { y: yChange(0), label: '0' },
              { y: yChange(-maxChange), label: formatPoints(-maxChange) },
            ]}
          />
          {rows.map((r, i) => {
            if (r.changeBp === null) return null;
            const y0 = yChange(0);
            const y1 = yChange(r.changeBp);
            return (
              <rect
                key={r.date}
                x={x(i) - barW / 2}
                y={Math.min(y0, y1)}
                width={barW}
                height={Math.max(1, Math.abs(y1 - y0))}
                fill={r.changeBp >= 0 ? 'var(--chart-2)' : 'var(--danger)'}
              >
                <title>{`${displayDate(r.date)}: ${formatPoints(Math.round(r.changeBp / 100) * 100)}`}</title>
              </rect>
            );
          })}
        </svg>
      </Frame>
    </section>
  );
}
