'use client';
import { useState } from 'react';
import { formatOccupancy } from '@pms/domain';
import { countLabel, msg, type Translate } from '../../i18n';
import { useLocale, useT } from '../../i18n/locale-provider';

export interface ChartPoint {
  date: string;
  /** подпись даты, готовится на сервере (чч.мм) */
  label: string;
  ownBp: number | null;
  marketBp: number | null;
  count: number;
}

const pct = (bp: number | null, t: Translate) =>
  bp === null ? t('нет данных') : formatOccupancy(Math.round(bp / 100) * 100);

/**
 * «Сравнение загрузки» (COMP3.2): две линии по датам окна, вы и средняя по рынку. Разрывы честные:
 * ночь без данных не соединяется с соседями. Подсказка при наведении: дата, оба значения и по скольким
 * конкурентам посчитан рынок. Значения без наведения: таблица в <details> ниже (как у аналитики сайта).
 * Цвета: токены `--chart-*`, сетка и подписи осей: свои переменные (dataviz).
 */
export function OccupancyChart({ points }: { points: ChartPoint[] }) {
  const t = useT();
  const locale = useLocale();
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
    <div className="chart market-trend" data-testid="market-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={t('Сравнение загрузки: вы и средняя по рынку, по ночам')}
        className="chart__svg"
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={padL} x2={W - padR} y1={y(tick)} y2={y(tick)} stroke="var(--grid-line)" strokeWidth={1} />
            <text x={padL - 6} y={y(tick) + 4} textAnchor="end" fontSize={13} fill="var(--muted-2)">
              {tick / 100}%
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
            <b>{pct(h.ownBp, t)}</b>
            <span>{t('вы')}</span>
          </div>
          <div className="chart__tip-row">
            <b>{pct(h.marketBp, t)}</b>
            <span>
              {h.count > 0
                ? t('рынок, по {n}', {
                    n: countLabel(locale, t, h.count, [msg('конкуренту'), msg('конкурентам'), msg('конкурентам')]),
                  })
                : t('рынок')}
            </span>
          </div>
        </div>
      )}
      <ul className="market-trend__legend" aria-hidden="true">
        <li>
          <span className="market-trend__swatch market-trend__swatch--own" />
          {t('Вы')}
        </li>
        <li>
          <span className="market-trend__swatch market-trend__swatch--market" />
          {t('Средняя по рынку')}
        </li>
      </ul>
      <details className="market-trend__data">
        <summary>{t('Значения по ночам')}</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">{t('Ночь')}</th>
              <th scope="col">{t('Вы')}</th>
              <th scope="col">{t('Рынок')}</th>
              <th scope="col">{t('Конкурентов с данными')}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.date}>
                <th scope="row">{p.label}</th>
                <td>{pct(p.ownBp, t)}</td>
                <td>{pct(p.marketBp, t)}</td>
                <td>{p.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
