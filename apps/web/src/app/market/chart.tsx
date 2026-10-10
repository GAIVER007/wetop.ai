'use client';
import { useState } from 'react';
import { formatOccupancy } from '@pms/domain';
import { pluralRu } from '../../lib/plural';

export interface ChartPoint {
  date: string;
  /** подпись даты, готовится на сервере (чч.мм) */
  label: string;
  ownBp: number | null;
  marketBp: number | null;
  count: number;
}

const pct = (bp: number | null) =>
  bp === null ? 'нет данных' : formatOccupancy(Math.round(bp / 100) * 100);

/**
 * «Сравнение загрузки» (COMP3.2): две линии по датам окна, вы и средняя по рынку. Разрывы честные:
 * ночь без данных не соединяется с соседями. Подсказка при наведении: дата, оба значения и по скольким
 * конкурентам посчитан рынок. Значения без наведения: таблица в <details> ниже (как у аналитики сайта).
 * Цвета: токены `--chart-*`, сетка и подписи осей: свои переменные (dataviz).
 */
export function OccupancyChart({ points }: { points: ChartPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 220;
  const padL = 40;
  const padR = 12;
  const padT = 12;
  const padB = 24;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = Math.max(points.length, 1);
  const band = plotW / n;
  const x = (i: number) => padL + i * band + band / 2;
  const y = (bp: number) => padT + plotH - (bp / 10000) * plotH;
  const ticks = [0, 2500, 5000, 7500, 10000];
  const labelEvery = n > 20 ? 5 : n > 10 ? 2 : 1;
  const h = hover !== null ? points[hover] : null;
  const path = (key: 'ownBp' | 'marketBp') => {
    const parts: string[] = [];
    let open = false;
    points.forEach((p, i) => {
      const v = p[key];
      if (v === null) {
        open = false;
        return;
      }
      parts.push(`${open ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`);
      open = true;
    });
    return parts.join(' ');
  };
  return (
    <div className="chart market-chart" data-testid="market-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label="Сравнение загрузки: вы и средняя по рынку, по ночам"
        className="chart__svg"
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--grid-line)" strokeWidth={1} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize={13} fill="var(--muted-2)">
              {t / 100}%
            </text>
          </g>
        ))}
        <path d={path('marketBp')} fill="none" stroke="var(--chart-2)" strokeWidth={2} strokeLinejoin="round" />
        <path d={path('ownBp')} fill="none" stroke="var(--chart-1)" strokeWidth={2.5} strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={p.date}>
            {i % labelEvery === 0 && (
              <text x={x(i)} y={H - 6} textAnchor="middle" fontSize={13} fill="var(--muted-2)">
                {Number(p.date.slice(8, 10))}
              </text>
            )}
            {hover === i && (
              <line x1={x(i)} x2={x(i)} y1={padT} y2={padT + plotH} stroke="var(--axis-line)" strokeWidth={1} />
            )}
            {p.ownBp !== null && hover === i && <circle cx={x(i)} cy={y(p.ownBp)} r={4} fill="var(--chart-1)" />}
            {p.marketBp !== null && hover === i && (
              <circle cx={x(i)} cy={y(p.marketBp)} r={4} fill="var(--chart-2)" />
            )}
            <rect
              x={padL + i * band}
              y={padT}
              width={band}
              height={plotH}
              fill="transparent"
              onPointerMove={() => setHover(i)}
              onFocus={() => setHover(i)}
              tabIndex={-1}
            />
          </g>
        ))}
      </svg>
      {h && hover !== null && (
        <div
          role="status"
          className="chart__tip"
          style={{ /* slop-allow: inline-style позиция подсказки от наведённого столбца, из данных */
            left: `${((padL + hover * band + band / 2) / W) * 100}%`,
            transform: hover > n / 2 ? 'translateX(-100%)' : 'none',
          }}
        >
          <div className="chart__tip-date">{h.label}</div>
          <div className="chart__tip-row">
            <b>{pct(h.ownBp)}</b>
            <span>вы</span>
          </div>
          <div className="chart__tip-row">
            <b>{pct(h.marketBp)}</b>
            <span>
              рынок{h.count > 0 ? `, по ${pluralRu(h.count, ['конкуренту', 'конкурентам', 'конкурентам'])}` : ''}
            </span>
          </div>
        </div>
      )}
      <ul className="market-chart__legend" aria-hidden="true">
        <li>
          <span className="market-chart__swatch market-chart__swatch--own" />
          Вы
        </li>
        <li>
          <span className="market-chart__swatch market-chart__swatch--market" />
          Средняя по рынку
        </li>
      </ul>
      <details className="market-chart__data">
        <summary>Значения по ночам</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Ночь</th>
              <th scope="col">Вы</th>
              <th scope="col">Рынок</th>
              <th scope="col">Конкурентов с данными</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.date}>
                <th scope="row">{p.label}</th>
                <td>{pct(p.ownBp)}</td>
                <td>{pct(p.marketBp)}</td>
                <td>{p.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
