import type { ReactNode } from 'react';
import { donutSlices, type DonutItem } from '../lib/donut';
import { formatPercent } from '../lib/dashboard-format';

const R = 48;
const C = 2 * Math.PI * R;

/**
 * Кольцо долей (RPT2.2c-3, DESIGN.md §8.2 `DonutShare`). Доли и суммы приходят целыми числами (`donutSlices`),
 * кольцо только рисует их дугами. Смысл держит список рядом: имя, доля числом и сумма; кольцо для программы чтения
 * скрыто, а цвет это оттенки одного цвета графика, а не набор разных цветов. Больше `max` долей сворачиваются в «Прочие».
 */
export function DonutShare({
  items,
  centerLabel,
  centerValue,
  amount,
  testId,
  max = 5,
}: {
  items: DonutItem[];
  /** Подпись под числом в центре */
  centerLabel: string;
  /** Число в центре, уже отформатированное: итог по всем долям */
  centerValue: ReactNode;
  /** Сумма доли для списка, уже отформатированная */
  amount: (valueMinor: string) => string;
  testId: string;
  max?: number;
}) {
  const slices = donutSlices(items, max);
  if (slices.length === 0) return null;
  return (
    <div className="donut" data-testid={testId}>
      <div className="donut__ring">
        <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
          <g transform="rotate(-90 60 60)">
            {slices.map((s, i) => (
              <circle
                key={s.label}
                className={`donut__seg donut__seg--${Math.min(i, 4)}`}
                cx="60"
                cy="60"
                r={R}
                strokeDasharray={`${Math.max(0, (C * s.permille) / 1000 - 1)} ${C}`}
                strokeDashoffset={-((C * s.startPermille) / 1000)}
              />
            ))}
          </g>
        </svg>
        <div className="donut__center">
          <strong>{centerValue}</strong>
          <span>{centerLabel}</span>
        </div>
      </div>
      <ul className="donut__legend">
        {slices.map((s, i) => (
          <li key={s.label}>
            <i className={`donut__swatch donut__swatch--${Math.min(i, 4)}`} aria-hidden="true" />
            <span className="donut__name">{s.label}</span>
            <span className="donut__share">{formatPercent(s.permille / 10)}</span>
            <span className="donut__amount">{amount(s.valueMinor)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
