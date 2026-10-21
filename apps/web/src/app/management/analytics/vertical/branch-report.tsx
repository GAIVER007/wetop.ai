import type { ReactNode } from 'react';
import { Panel, Stat, Stats } from '../../../../components/ui';
import { ShareBar, type ShareBarTone } from '../../../../components/share-bar';
import { moneyText } from './metrics';

const TONES: Record<string, ShareBarTone> = {
  BOOKED: 'info',
  CONFIRMED: 'info',
  IN_PROGRESS: 'warning',
  SEATED: 'warning',
  DONE: 'success',
  COMPLETED: 'success',
  NO_SHOW: 'danger',
  CANCELLED: 'neutral',
};

/** Один филиал на один экран: ряд статусов, выручка слева, доли статусов справа. */
export function BranchReport({
  labels,
  counts,
  revenue,
  foodPanel,
}: {
  labels: Record<string, string>;
  counts: Record<string, number>;
  /** null: финансовый учёт направления не подключён */
  revenue: Record<string, string> | null;
  /** панель направления без выручки (ресторан) */
  foodPanel?: ReactNode;
}) {
  const entries = Object.entries(labels);
  const total = entries.reduce((sum, [status]) => sum + (counts[status] ?? 0), 0);
  const currencies = revenue ? Object.entries(revenue) : [];
  return (
    <div className="branch-report">
      <Stats min={120} aria-label="Статусы за период">
        {entries.map(([status, label]) => (
          <Stat
            key={status}
            label={label}
            value={counts[status] ?? 0}
            testId={`period-${status}`}
          />
        ))}
      </Stats>
      <div className="branch-report__cols">
        {revenue !== null ? (
          <Panel title="Выручка по завершённым записям">
            {currencies.length ? (
              currencies.map(([currency, minor]) => (
                <p
                  key={currency}
                  className="branch-report__money"
                  data-testid={`revenue-${currency}`}
                >
                  {moneyText(minor, currency)}
                </p>
              ))
            ) : (
              <p className="branch-report__empty">Завершённых записей за период нет.</p>
            )}
            <p className="muted">
              Цены записей со статусом «Завершено», это не полученные оплаты. Валюты отдельно.
            </p>
          </Panel>
        ) : (
          (foodPanel ?? null)
        )}
        <Panel title={`Записи по статусам, всего ${total}`}>
          {total === 0 ? (
            <p className="branch-report__empty">Записей за период нет.</p>
          ) : (
            <ul className="branch-report__shares">
              {entries.map(([status, label]) => (
                <li key={status}>
                  <span>{label}</span>
                  <ShareBar
                    label={label}
                    value={counts[status] ?? 0}
                    max={total}
                    tone={TONES[status] ?? 'neutral'}
                  />
                  <b>{counts[status] ?? 0}</b>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
