import { formatMoney } from '../../lib/money';
import { METHOD_RU } from '../../lib/dashboard-format';
import { beautyStatus } from '../../lib/status/beauty';
import { msg, type Translate } from '../../i18n';
import { useT } from '../../i18n/locale-provider';
import type {
  BeautyAppointmentHistoryResponse,
  BeautyAppointmentHistorySnapshot,
} from '../../lib/api';

export type AppointmentHistorySnapshot = BeautyAppointmentHistorySnapshot;
export type AppointmentHistoryData = BeautyAppointmentHistoryResponse;

const ACTION_LABELS: Record<AppointmentHistoryData['items'][number]['action'], string> = {
  'beauty.appointment.created': msg('Запись создана'),
  'beauty.appointment.moved': msg('Запись изменена'),
  'beauty.appointment.status': msg('Статус изменён'),
  'beauty.appointment.paid': msg('Оплата добавлена'),
  'beauty.appointment.refunded': msg('Возврат оформлен'),
};

function localDateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function snapshotValue(
  snapshot: AppointmentHistorySnapshot,
  field: string,
  timezone: string,
  currency: string,
  t: Translate,
): string | undefined {
  if (field === 'startsAt' && snapshot.startsAt) return localDateTime(snapshot.startsAt, timezone);
  if (field === 'endsAt' && snapshot.endsAt) return localDateTime(snapshot.endsAt, timezone);
  if (field === 'employee') return snapshot.employee?.name;
  if (field === 'service') return snapshot.service?.name;
  if (field === 'priceMinor' && snapshot.priceMinor)
    return formatMoney(snapshot.priceMinor, currency);
  if (field === 'status' && snapshot.status)
    return t(beautyStatus[snapshot.status as keyof typeof beautyStatus]?.label ?? snapshot.status);
  if (field === 'method' && snapshot.method) return t(METHOD_RU[snapshot.method] ?? snapshot.method);
  if (field === 'amountMinor' && snapshot.amountMinor)
    return formatMoney(snapshot.amountMinor, currency);
  if (field === 'paidMinor' && snapshot.paidMinor) return formatMoney(snapshot.paidMinor, currency);
  if (field === 'reason') return snapshot.reason;
  return undefined;
}

const FIELDS = [
  ['startsAt', msg('Начало')],
  ['endsAt', msg('Окончание')],
  ['employee', msg('Специалист')],
  ['service', msg('Услуга')],
  ['priceMinor', msg('Стоимость')],
  ['status', msg('Статус')],
  ['method', msg('Способ оплаты')],
  ['amountMinor', msg('Сумма')],
  ['paidMinor', msg('Оплачено всего')],
  ['reason', msg('Причина')],
] as const;

function SnapshotChanges({
  before,
  after,
  timezone,
  currency,
}: {
  before: AppointmentHistorySnapshot;
  after: AppointmentHistorySnapshot;
  timezone: string;
  currency: string;
}) {
  const t = useT();
  const changes = FIELDS.flatMap(([field, label]) => {
    const oldValue = snapshotValue(before, field, timezone, currency, t);
    const newValue = snapshotValue(after, field, timezone, currency, t);
    if (!oldValue && !newValue) return [];
    return [{ field, label, oldValue, newValue }];
  });
  return (
    <>
      {changes.length > 0 && (
        <dl className="appointment-history__changes">
          {changes.map(({ field, label, oldValue, newValue }) => (
            <div key={field}>
              <dt>{t(label)}</dt>
              <dd>{oldValue && newValue ? `${oldValue} → ${newValue}` : (newValue ?? oldValue)}</dd>
            </div>
          ))}
        </dl>
      )}
      {after.items && after.items.length > 0 && (
        <ol className="appointment-history__services" aria-label={t('Услуги записи')}>
          {after.items.map((item) => (
            <li key={`${item.position}-${item.service.id}-${item.employee.id}`}>
              <strong>{item.service.name}</strong>, {item.employee.name},{' '}
              {localDateTime(item.startsAt, timezone)}, {formatMoney(item.priceMinor, currency)}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

export function AppointmentHistory({ history }: { history: AppointmentHistoryData }) {
  const t = useT();
  return (
    <section className="appointment-history" aria-label={t('История изменений записи')}>
      {history.truncated && <p className="muted">{t('Показаны последние 100 событий.')}</p>}
      {history.items.length === 0 ? (
        <p className="muted">{t('История изменений пока пуста.')}</p>
      ) : (
        <ol className="appointment-history__list">
          {history.items.map((item) => (
            <li key={item.id} className="panel appointment-history__event">
              <header>
                <strong>{t(ACTION_LABELS[item.action])}</strong>
                <span className="muted">
                  <time dateTime={item.at}>{localDateTime(item.at, history.timezone)}</time>
                  {`, ${item.author?.name ?? t('Система')}`}
                </span>
              </header>
              <SnapshotChanges
                before={item.before}
                after={item.after}
                timezone={history.timezone}
                currency={history.currency}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
