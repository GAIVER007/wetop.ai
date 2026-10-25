import type { ReactNode } from 'react';
import { Panel } from '../../../../components/ui';
import { ShareBar, type ShareBarTone } from '../../../../components/share-bar';
import { moneyText } from './metrics';
import { msg, translator, type Translate } from '../../../../i18n';

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
  statusTitle = msg('Записи по статусам'),
  statusEmpty = msg('Записей за период нет.'),
  t = translator('ru'),
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
  t?: Translate;
}) {
  const entries = Object.entries(labels);
  const total = entries.reduce((sum, [status]) => sum + (counts[status] ?? 0), 0);
  const currencies = revenue ? Object.entries(revenue) : [];
  return (
    <div className="branch-report">
      <div className="branch-report__cols">
        {revenue !== null ? (
          <Panel title={t('Выручка по завершённым записям')}>
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
              <p className="branch-report__empty">{t('Завершённых записей за период нет.')}</p>
            )}
            <p className="muted">
              {t(
                'Цены записей со статусом «Завершено», это не полученные оплаты. Валюты отдельно.',
              )}
            </p>
          </Panel>
        ) : (
          (foodPanel ?? null)
        )}
        <Panel title={t('{title}, всего {n}', { title: t(statusTitle), n: total })}>
          {total === 0 && <p className="branch-report__empty">{t(statusEmpty)}</p>}
          <ul className="branch-report__shares">
            {entries.map(([status, label]) => (
              <li key={status}>
                <span>{t(label)}</span>
                {total > 0 ? (
                  <ShareBar
                    label={t(label)}
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
