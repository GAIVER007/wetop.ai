import type { ReservationHistory } from '../../../lib/api';
import { EmptyState } from '../../../components/ui';
import type { Translate } from '../../../i18n';
import { OperationDetails } from '../../journal/operation-details';
import { actionLabel, entityLabel } from '../../journal/labels';
import { riskChange, riskComment } from '../../journal/journal-risk';
import { formatMoney } from '../../../lib/money';
import { dateFormat } from '../../../i18n/dates';

/**
 * «История изменений» брони (владелец 30.10.2026: «как единую систему, лучшее в каждом разделе»), как у записи
 * салона: когда, кто, что сделал, было и стало по деньгам, комментарий; подробности строкой ниже. Данные из
 * общего журнала (`GET /reservation-history/:number`), без ФИО гостя в снимках.
 */
export function BookingHistory({ history, t, locale }: { history: ReservationHistory; t: Translate; locale: Parameters<typeof dateFormat>[0] }) {
  if (!history.items.length) return <EmptyState title={t('Изменений по брони пока нет')} data-testid="booking-history-empty" />;
  const when = dateFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: history.timezone });
  return (
    <ol className="booking-history" data-testid="booking-history">
      {history.items.map((row) => {
        const change = riskChange(row.before, row.after);
        const comment = riskComment(row.before, row.after);
        const currency = change?.currency ?? history.currency;
        return (
          <li key={row.id} data-testid="booking-history-row">
            <div className="booking-history__head">
              <time dateTime={row.at}>{when.format(new Date(row.at))}</time>
              <b>{actionLabel(row.action, t)}</b>
              <span className="muted">{entityLabel(row.entityType, t)}</span>
              <span>{row.author ?? t('Система')}</span>
            </div>
            {change && (
              <p className="booking-history__money" data-testid="booking-history-change">
                {change.before !== null && (
                  <>
                    <s>{formatMoney(change.before, currency)}</s>{' '}
                  </>
                )}
                <b>{formatMoney(change.after, currency)}</b>
              </p>
            )}
            {comment && <p className="booking-history__note">{t('Комментарий: {text}', { text: comment })}</p>}
            <details>
              <summary>{t('Подробнее')}</summary>
              <OperationDetails before={row.before} after={row.after} t={t} />
            </details>
          </li>
        );
      })}
      {history.truncated && <li className="muted">{t('Показаны последние 100 изменений, остальные в «Истории действий»')}</li>}
    </ol>
  );
}
