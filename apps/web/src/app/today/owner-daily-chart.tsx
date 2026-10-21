'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { lineGeometry } from '../../lib/line-geometry';
import { formatOwnerMoney, ownerReason, type DailyMoney } from '../../lib/owner-summary';

type Metric = { label: string; daily?: DailyMoney | undefined; previous?: DailyMoney | undefined };

/** One metric and currency at a time. Previous days align by position, never by invented hours. */
export function OwnerDailyChart({ metrics }: { metrics: Metric[] }) {
  const id = useId();
  const [selected, setSelected] = useState(0);
  const [chosenCurrency, setCurrency] = useState('');
  const plot = useRef<SVGSVGElement>(null);
  const [plotWidth, setPlotWidth] = useState(800);
  const metric = metrics[selected];
  const daily = metric?.daily;
  const previous = metric?.previous;
  const currencies = [...new Set([daily, previous].flatMap(d => d?.state !== 'UNAVAILABLE' ? d?.currencies?.map(c => c.currency) ?? [] : []))].sort();
  const currency = currencies.includes(chosenCurrency) ? chosenCurrency : currencies[0];
  const currentDays = daily?.state !== 'UNAVAILABLE' ? daily?.days ?? [] : [];
  const previousDays = previous?.state !== 'UNAVAILABLE' ? previous?.days ?? [] : [];
  const count = Math.max(currentDays.length, previousDays.length);
  const rows = Array.from({ length: count }, (_, i) => [currentDays[i], previousDays[i]]);
  const values = [currentDays, previousDays].map(days => Array.from({ length: count }, (_, i) => {
    const day = days[i];
    const amount = day?.currencies.find(c => c.currency === currency)?.amountMinor;
    return !day || day.unresolvedSources !== 0 || amount === undefined ? null : BigInt(amount);
  }));
  const known = values.flat().filter((n): n is bigint => n !== null);
  const minimum = known.reduce((a, b) => a < b ? a : b, 0n);
  const maximum = known.reduce((a, b) => a > b ? a : b, 0n);
  const range = maximum - minimum || 1n;
  // Only bounded drawing coordinates become Number. Exact monetary amounts remain BigInt/string.
  const geometry = lineGeometry(values.map(series => series.map(n => n === null ? null : Number((n - minimum) * 10000n / range) / 100)), {
    width: plotWidth, height: 230, pad: { left: 100, right: 18, top: 14, bottom: 32 },
  });
  const hasPrevious = values[1]!.some(n => n !== null);
  const hasPoints = known.length > 0 && currency !== undefined;
  useEffect(() => {
    const element = plot.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width > 0) setPlotWidth(Math.max(240, Math.round(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasPoints]);
  const axisLabel = (value: bigint) => {
    const digits = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: currency! }).resolvedOptions().maximumFractionDigits ?? 2;
    const scale = 10n ** BigInt(digits), absolute = value < 0n ? -value : value;
    if (absolute < 1000n * scale) return formatOwnerMoney(value.toString(), currency!).replace(` ${currency}`, '');
    const major = value / scale;
    const compact = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(major);
    return compact.length <= 12 ? compact : new Intl.NumberFormat('ru-RU', { notation: 'scientific', maximumFractionDigits: 1 }).format(major);
  };
  return <div className="owner-chart">
    <div className="owner-chart-toolbar">
      <div className="owner-chart-tabs" role="tablist" aria-label="Данные графика">
        {metrics.map((m, index) => <button key={m.label} type="button" role="tab" id={`${id}-tab-${index}`} aria-controls={`${id}-panel`} aria-selected={selected === index} tabIndex={selected === index ? 0 : -1}
          onClick={() => setSelected(index)} onKeyDown={event => {
            const next = event.key === 'ArrowRight' ? (index + 1) % metrics.length : event.key === 'ArrowLeft' ? (index + metrics.length - 1) % metrics.length : event.key === 'Home' ? 0 : event.key === 'End' ? metrics.length - 1 : null;
            if (next !== null) { event.preventDefault(); setSelected(next); document.getElementById(`${id}-tab-${next}`)?.focus(); }
          }}>{m.label}</button>)}
      </div>
      <div className="owner-chart-legend"><span>Текущий период</span>{hasPrevious && <span className="owner-chart-previous">Предыдущий</span>}</div>
    </div>
    <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${selected}`} tabIndex={0}>
      {currencies.length > 1 && <label className="owner-chart-currency">Валюта: <select value={currency} onChange={event => setCurrency(event.target.value)}>{currencies.map(c => <option key={c}>{c}</option>)}</select></label>}
      {daily?.state !== 'READY' && <p role="status">{metric?.label}: {daily ? ownerReason(daily.reason) || 'Данные периода неполные' : 'Временной ряд не подключён'}{daily?.unresolvedSources ? ` Не определена валюта операций: ${daily.unresolvedSources}.` : ''}</p>}
      {previous?.state === 'PARTIAL' && <p role="status">Предыдущий период: данные неполные</p>}
      {hasPoints ? <>
        <svg ref={plot} className="owner-chart-plot" viewBox={`0 0 ${plotWidth} 230`} width="100%" role="img" aria-label={`${metric?.label} по дням, ${currency}`}>
          {[0, 1, 2, 3, 4].map(tick => {
            const y = 198 - tick * 46;
            const amount = minimum + range * BigInt(tick) / 4n;
            return <g key={tick} className="owner-chart-grid"><line x1="100" x2={plotWidth - 18} y1={y} y2={y} /><text x="90" y={y + 4} textAnchor="end">{axisLabel(amount)}<title>{formatOwnerMoney(amount.toString(), currency)}</title></text></g>;
          })}
          {geometry.series.map((series, index) => <g key={index} data-series={index ? 'previous' : 'current'} fill="none" stroke={index ? 'var(--muted)' : 'var(--primary)'} strokeWidth="2" strokeDasharray={index ? '5 5' : undefined}>
            {series.segments.map(d => <path key={d} d={d} />)}
            {series.dots.map(point => <circle key={point.index} cx={point.x} cy={point.y} r="3" fill="var(--surface)"><title>{`${rows[point.index]?.[index]?.date}: ${formatOwnerMoney(values[index]![point.index]!.toString(), currency)}`}</title></circle>)}
          </g>)}
          {rows.map((row, i) => (i === 0 || i === count - 1 || i === Math.floor((count - 1) / 2)) && <text key={i} className="owner-chart-date" x={geometry.xs[i]} y="224" textAnchor={i === 0 ? 'start' : i === count - 1 ? 'end' : 'middle'}>{(row[0] ?? row[1])?.date.slice(5).split('-').reverse().join('.')}<title>{(row[0] ?? row[1])?.date}</title></text>)}
        </svg>
        <details className="owner-chart-table"><summary>Точные дневные суммы, {currency}</summary>
          <table><caption>{metric?.label}, {currency}. Дни периодов сопоставлены по порядку.</caption><thead><tr><th scope="col">Дата</th><th scope="col">Текущий период</th>{hasPrevious && <><th scope="col">Дата сравнения</th><th scope="col">Предыдущий период</th></>}</tr></thead><tbody>
            {rows.map((row, i) => <tr key={i}><th scope="row">{row[0]?.date ?? 'Нет данных'}</th><td>{row[0] && row[0].unresolvedSources !== 0 ? 'Данные неполные' : values[0]![i] === null ? 'Нет данных' : formatOwnerMoney(values[0]![i]!.toString(), currency)}</td>{hasPrevious && <><td>{row[1]?.date ?? 'Нет данных'}</td><td>{row[1] && row[1].unresolvedSources !== 0 ? 'Данные неполные' : values[1]![i] === null ? 'Нет данных' : formatOwnerMoney(values[1]![i]!.toString(), currency)}</td></>}</tr>)}
          </tbody></table>
        </details>
      </> : <div className="owner-chart-empty" role="status"><strong>Нет данных для графика</strong><p>За этот период ещё нет операций. График появится после первой оплаты или расхода.</p></div>}
      <p className="owner-chart-foot">По дням в часовом поясе филиала, текущий день неполный{!hasPrevious && ', сравнение недоступно'}</p>
    </div>
  </div>;
}
