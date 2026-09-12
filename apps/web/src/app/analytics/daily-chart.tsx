'use client';
import { useState } from 'react';

export interface DailyPoint {
  date: string;
  sessions: number;
  visitors: number;
  pageviews: number;
  mobile: number;
}

/**
 * Столбцы по дням (dataviz: ≤ 24px, скруглённый верх, квадрат у базовой линии, зазор 2px, hairline-сетка,
 * подсказка на каждом столбце, значения не на каждой точке). Одна серия — легенда не нужна, её называет
 * заголовок. Таблица по дням — рядом в <details>, чтобы значения были доступны без наведения.
 */
export function DailyChart({
  rows,
  valueKey,
  color,
  label,
  testId,
}: {
  rows: DailyPoint[];
  valueKey: 'sessions' | 'mobile' | 'visitors' | 'pageviews';
  color: string;
  label: string;
  testId?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 180;
  const padL = 36;
  const padR = 8;
  const padT = 12;
  const padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = Math.max(rows.length, 1);
  const band = plotW / n;
  const barW = Math.min(24, Math.max(2, band - 2));
  const max = Math.max(1, ...rows.map((r) => r[valueKey]));
  const top = niceCeil(max);
  const ticks = [0, top / 2, top];
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const labelEvery = n > 20 ? 5 : n > 10 ? 2 : 1;
  const h = hover !== null ? rows[hover] : null;
  return (
    <div
      style={{
        position: 'relative',
        background: '#fcfcfb',
        border: '1px solid #e3e5e8',
        borderRadius: 8,
        padding: '10px 12px 6px',
      }}
      data-testid={testId}
    >
      <div style={{ fontSize: 13, color: '#52514e', marginBottom: 4 }}>{label}</div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={label}
        style={{ display: 'block', fontFamily: 'system-ui, sans-serif' }}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#e1e0d9" strokeWidth={1} />
            <text
              x={padL - 6}
              y={y(t) + 4}
              textAnchor="end"
              fontSize={11}
              fill="#898781"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {fmt(t)}
            </text>
          </g>
        ))}
        <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} stroke="#c3c2b7" strokeWidth={1} />
        {rows.map((r, i) => {
          const v = r[valueKey];
          const x = padL + i * band + (band - barW) / 2;
          const yTop = y(v);
          const hgt = Math.max(0, y(0) - yTop);
          const rx = Math.min(4, barW / 2);
          const d =
            hgt <= 0
              ? ''
              : hgt < rx
                ? `M${x},${y(0)} v${-hgt} h${barW} v${hgt} z`
                : `M${x},${y(0)} v${-(hgt - rx)} a${rx},${rx} 0 0 1 ${rx},${-rx} h${barW - 2 * rx} a${rx},${rx} 0 0 1 ${rx},${rx} v${hgt - rx} z`;
          const showLabel = i % labelEvery === 0;
          return (
            <g key={r.date}>
              {d && <path d={d} fill={color} opacity={hover === null || hover === i ? 1 : 0.55} />}
              {showLabel && (
                <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="#898781">
                  {Number(r.date.slice(8, 10))}
                </text>
              )}
              {/* область наведения шире столбца: вся полоса дня */}
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
          );
        })}
      </svg>
      {h && hover !== null && (
        <div
          role="status"
          style={{
            position: 'absolute',
            left: `calc(${((padL + hover * band + band / 2) / W) * 100}% )`,
            top: 30,
            transform: hover > n / 2 ? 'translateX(-100%)' : 'none',
            background: '#fff',
            border: '1px solid #e3e5e8',
            borderRadius: 6,
            boxShadow: '0 2px 8px rgba(11,11,11,0.10)',
            padding: '6px 10px',
            fontSize: 12,
            color: '#52514e',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ color: '#0b0b0b', fontWeight: 600 }}>{h.date}</div>
          <Row k="сессий" v={h.sessions} />
          <Row k="посетителей" v={h.visitors} />
          <Row k="просмотров" v={h.pageviews} />
          <Row k="с мобильных" v={h.mobile} />
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: number }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
      <span style={{ fontWeight: 600, color: '#0b0b0b', fontVariantNumeric: 'tabular-nums' }}>
        {v}
      </span>
      <span>{k}</span>
    </div>
  );
}

/** Верх оси: для маленьких счётчиков — ближайшее чётное (деления 0 / n/2 / n целые), дальше — «круглое». */
function niceCeil(v: number): number {
  if (v <= 10) return Math.max(2, Math.ceil(v / 2) * 2);
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  const step = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10;
  return step * p;
}
const fmt = (v: number) => (Number.isInteger(v) ? v.toLocaleString('ru-RU') : v.toFixed(1));
