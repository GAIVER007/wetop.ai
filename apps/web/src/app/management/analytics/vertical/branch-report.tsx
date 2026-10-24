import type { ReactNode } from 'react';
import { Panel } from '../../../../components/ui';
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

/** Один филиал на один экран: выручка слева, статусы полосками с числами справа, без плиток (правило владельца). */
export function BranchReport({
  labels,
  counts,
  revenue,
  foodPanel,
  statusTitle = 'Записи по статусам',
  statusEmpty = 'Записей за период нет.',
}: {
  labels: Record<string, string>;
  counts: Record<string, number>;
  /** null: финансовый учёт направления не подключён */
  revenue: Record<string, string> | null;
  /** панель направления без выручки (ресторан) */
  foodPanel?: ReactNode;
  /** заголовок блока статусов словами направления: у ресторана «Брони по статусам» */
  statusTitle?: string;
  statusEmpty?: string;
}) {
  const entries = Object.entries(labels);
  const total = entries.reduce((sum, [status]) => sum + (counts[status] ?? 0), 0);
  const currencies = revenue ? Object.entries(revenue) : [];
  return (
    <div className="branch-report">
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
        <Panel title={`${statusTitle}, всего ${total}`}>
          {total === 0 && <p className="branch-report__empty">{statusEmpty}</p>}
          <ul className="branch-report__shares">
            {entries.map(([status, label]) => (
              <li key={status}>
                <span>{label}</span>
                {total > 0 ? (
                  <ShareBar
                    label={label}
                    value={counts[status] ?? 0}
                    max={total}
                    tone={TONES[status] ?? 'neutral'}
                  />
                ) : (
                  <span aria-hidden="true" />
                )}
                <b data-testid={`period-${status}`}>{counts[status] ?? 0}</b>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
