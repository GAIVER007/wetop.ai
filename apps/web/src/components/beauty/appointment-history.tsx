import { formatMoney } from '../../lib/money';
import { METHOD_RU } from '../../lib/dashboard-format';
import { beautyStatus } from '../../lib/status/beauty';
import type {
  BeautyAppointmentHistoryResponse,
  BeautyAppointmentHistorySnapshot,
} from '../../lib/api';

export type AppointmentHistorySnapshot = BeautyAppointmentHistorySnapshot;
export type AppointmentHistoryData = BeautyAppointmentHistoryResponse;

const ACTION_LABELS: Record<AppointmentHistoryData['items'][number]['action'], string> = {
  'beauty.appointment.created': 'Запись создана',
  'beauty.appointment.moved': 'Запись изменена',
  'beauty.appointment.status': 'Статус изменён',
  'beauty.appointment.paid': 'Оплата добавлена',
  'beauty.appointment.refunded': 'Возврат оформлен',
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
): string | undefined {
  if (field === 'startsAt' && snapshot.startsAt) return localDateTime(snapshot.startsAt, timezone);
  if (field === 'endsAt' && snapshot.endsAt) return localDateTime(snapshot.endsAt, timezone);
  if (field === 'employee') return snapshot.employee?.name;
  if (field === 'service') return snapshot.service?.name;
  if (field === 'priceMinor' && snapshot.priceMinor)
    return formatMoney(snapshot.priceMinor, currency);
  if (field === 'status' && snapshot.status)
    return beautyStatus[snapshot.status as keyof typeof beautyStatus]?.label ?? snapshot.status;
  if (field === 'method' && snapshot.method) return METHOD_RU[snapshot.method] ?? snapshot.method;
  if (field === 'amountMinor' && snapshot.amountMinor)
    return formatMoney(snapshot.amountMinor, currency);
  if (field === 'paidMinor' && snapshot.paidMinor) return formatMoney(snapshot.paidMinor, currency);
  if (field === 'reason') return snapshot.reason;
  return undefined;
}

const FIELDS = [
  ['startsAt', 'Начало'],
  ['endsAt', 'Окончание'],
  ['employee', 'Мастер'],
  ['service', 'Услуга'],
  ['priceMinor', 'Стоимость'],
  ['status', 'Статус'],
  ['method', 'Способ оплаты'],
  ['amountMinor', 'Сумма'],
  ['paidMinor', 'Оплачено всего'],
  ['reason', 'Причина'],
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
  const changes = FIELDS.flatMap(([field, label]) => {
    const oldValue = snapshotValue(before, field, timezone, currency);
    const newValue = snapshotValue(after, field, timezone, currency);
    if (!oldValue && !newValue) return [];
    return [{ field, label, oldValue, newValue }];
  });
  return (
    <>
      {changes.length > 0 && (
        <dl className="appointment-history__changes">
          {changes.map(({ field, label, oldValue, newValue }) => (
            <div key={field}>
              <dt>{label}</dt>
              <dd>{oldValue && newValue ? `${oldValue} → ${newValue}` : (newValue ?? oldValue)}</dd>
            </div>
          ))}
        </dl>
      )}
      {after.items && after.items.length > 0 && (
        <ol className="appointment-history__services" aria-label="Услуги записи">
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
  return (
    <section className="appointment-history" aria-label="История изменений записи">
      {history.truncated && <p className="muted">Показаны последние 100 событий.</p>}
      {history.items.length === 0 ? (
        <p className="muted">История изменений пока пуста.</p>
      ) : (
        <ol className="appointment-history__list">
          {history.items.map((item) => (
            <li key={item.id} className="panel appointment-history__event">
              <header>
                <strong>{ACTION_LABELS[item.action]}</strong>
                <span className="muted">
                  <time dateTime={item.at}>{localDateTime(item.at, history.timezone)}</time>
                  {`, ${item.author?.name ?? 'Система'}`}
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
