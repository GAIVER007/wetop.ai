'use client';
import { useState } from 'react';
import type { OverviewSeriesPoint } from '@pms/domain';
import { Segmented } from '../../components/segmented';
import { formatMoney } from '../../lib/money';
import { monthName } from '../../lib/platform-overview';
import './organizations.css';

/**
 * «Динамика по всем филиалам»: столбики по месяцам, переключатель Доход / Загрузка / Гости. Доход рисуется в одной
 * валюте за раз (разные валюты не складываются), валюта выбирается рядом. Месяц без данных это пустое место, а не ноль.
 */
type Metric = 'revenue' | 'load' | 'guests';
const OPTIONS = [
  { value: 'revenue', label: 'Доход' },
  { value: 'load', label: 'Загрузка' },
  { value: 'guests', label: 'Гости' },
] as const;

const short = (month: string) =>
  new Intl.DateTimeFormat('ru', { month: 'short', timeZone: 'UTC' })
    .format(new Date(`${month}-01T00:00:00Z`))
    .replace('.', '');

/** Высота столбика в процентах колонки; нет данных, тонкая черта */
const barHeight = (value: number | null, max: number): string =>
  `${value === null ? 2 : Math.max(4, Math.round((value / max) * 100))}%`;

export function Dynamics({ series }: { series: OverviewSeriesPoint[] }) {
  const [metric, setMetric] = useState<Metric>('revenue');
  const totals = new Map<string, number>();
  for (const p of series) for (const [c, v] of Object.entries(p.revenue)) totals.set(c, (totals.get(c) ?? 0) + v);
  const currencies = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const [picked, setPicked] = useState<string | null>(null);
  const currency = picked && currencies.includes(picked) ? picked : (currencies[0] ?? 'KZT');

  const values: Array<number | null> = series.map((p) => {
    if (metric === 'revenue') return p.revenue[currency] ?? null;
    if (metric === 'load') return p.unitNights > 0 ? Math.round((p.occupiedNights / p.unitNights) * 100) : null;
    return p.guests > 0 ? p.guests : null;
  });
  const max = Math.max(1, ...values.map((v) => v ?? 0));
  const show = (v: number | null): string => {
    if (v === null) return 'нет данных';
    if (metric === 'revenue') return formatMoney(BigInt(Math.round(v)), currency);
    return metric === 'load' ? `${v}%` : String(v);
  };
  const any = values.some((v) => v !== null);
  return (
    <section className="org-panel" aria-labelledby="org-dynamics-title" data-testid="platform-dynamics">
      <header className="org-panel__head">
        <h2 id="org-dynamics-title">Динамика по всем филиалам</h2>
        <Segmented
          label="Показатель"
          size="sm"
          value={metric}
          options={OPTIONS}
          onChange={(v) => setMetric(v)}
        />
      </header>
      {metric === 'revenue' && currencies.length > 1 && (
        <div className="org-dynamics__currencies" role="group" aria-label="Валюта">
          {currencies.map((c) => (
            <button
              key={c}
              type="button"
              className="chip chip--sm"
              aria-pressed={c === currency}
              onClick={() => setPicked(c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}
      {any ? (
        <>
          <div className="org-dynamics__bars" aria-hidden="true">
            {series.map((p, i) => (
              <div key={p.month} className="org-dynamics__col" title={`${monthName(p.month)}: ${show(values[i]!)}`}>
                <span className="org-dynamics__value">{values[i] === null ? '' : show(values[i]!)}</span>
                <span
                  className="org-dynamics__bar"
                  data-empty={values[i] === null || undefined}
                  style={{ height: barHeight(values[i] ?? null, max) }} // slop-allow: inline-style высота столбика из данных месяца
                />
                <span className="org-dynamics__month">{short(p.month)}</span>
              </div>
            ))}
          </div>
          <table className="sr-only">
            <caption>Динамика по месяцам</caption>
            <thead>
              <tr>
                <th>Месяц</th>
                <th>{OPTIONS.find((o) => o.value === metric)!.label}</th>
              </tr>
            </thead>
            <tbody>
              {series.map((p, i) => (
                <tr key={p.month}>
                  <th scope="row">{monthName(p.month)}</th>
                  <td>{show(values[i]!)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="muted org-panel__empty">За последние месяцы по этому показателю данных нет.</p>
      )}
      {metric === 'load' && <p className="muted org-panel__note">Загрузка считается только у гостиниц.</p>}
    </section>
  );
}
