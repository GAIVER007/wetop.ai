import { formatMoney } from '../../../lib/money';

/**
 * «Расходы по дням» (экран 5 макета): столбики SVG на токенах графика, по образцу графика /market.
 * Серверный компонент: данных на столбик достаточно, наведение отдаёт нативный `<title>`, а точные
 * значения лежат таблицей в `<details>`: тот же приём честной доступности, что в «Сравнении загрузки».
 */
const W = 720;
const H = 220;
/* слева место под «100 000 ₸»: при 64 px шестизначная подпись оси обрезалась (снимок analytics-dark-1440) */
const PAD = { top: 16, right: 8, bottom: 28, left: 96 };

/** Круглый потолок шкалы: 1-2-5 × 10ⁿ тиынов, чтобы деления не были дробными */
export function niceCeil(max: bigint): bigint {
  if (max <= 0n) return 100n;
  let step = 1n;
  while (step * 10n < max) step *= 10n;
  for (const k of [1n, 2n, 5n, 10n]) if (k * step >= max) return k * step;
  return 10n * step;
}

export function DailyChart({
  days,
  month,
  currency,
}: {
  days: bigint[];
  month: string;
  currency: string;
}) {
  const max = niceCeil(days.reduce((m, v) => (v > m ? v : m), 0n));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / days.length;
  const bar = Math.max(2, slot * 0.6);
  const y = (v: bigint) => PAD.top + innerH - Number((BigInt(Math.round(innerH * 1000)) * v) / max) / 1000;
  const ticks = [0n, max / 2n, max];
  const hasData = days.some((v) => v > 0n);
  return (
    <figure className="budget-chart" data-testid="budget-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Расходы по дням, ${currency}`}
        className="budget-chart__svg"
      >
        {ticks.map((t) => (
          <g key={t.toString()}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t)}
              y2={y(t)}
              className="budget-chart__grid"
            />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="budget-chart__tick">
              {formatMoney(t, currency)}
            </text>
          </g>
        ))}
        {days.map((v, i) => {
          const day = i + 1;
          if (v === 0n) return null;
          return (
            <rect
              key={day}
              x={PAD.left + i * slot + (slot - bar) / 2}
              y={y(v)}
              width={bar}
              height={PAD.top + innerH - y(v)}
              className="budget-chart__bar"
            >
              <title>{`${day}.${month.slice(5, 7)}: ${formatMoney(v, currency)}`}</title>
            </rect>
          );
        })}
        {[1, 8, 16, 24, days.length].map((day) => (
          <text
            key={day}
            x={PAD.left + (day - 1) * slot + slot / 2}
            y={H - 8}
            textAnchor="middle"
            className="budget-chart__tick"
          >
            {day}
          </text>
        ))}
      </svg>
      {!hasData && <p className="budget-chart__empty">В этом месяце расходов ещё нет.</p>}
      <details className="budget-chart__details">
        <summary>Значения по дням</summary>
        <ul>
          {days.map((v, i) =>
            v === 0n ? null : (
              <li key={i}>
                {i + 1}.{month.slice(5, 7)}: {formatMoney(v, currency)}
              </li>
            ),
          )}
        </ul>
      </details>
    </figure>
  );
}
