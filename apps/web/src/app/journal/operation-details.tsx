import { formatMoney } from '../../lib/money';
import { msg, translator, type Translate } from '../../i18n';

const RU = translator('ru');

const LABELS: Record<string, string> = {
  amountMinor: msg('Сумма'),
  commissionMinor: msg('Комиссия'),
  kind: msg('Операция'),
  method: msg('Способ оплаты'),
  methodTo: msg('Куда переведено'),
  category: msg('Статья'),
  status: msg('Статус'),
  voided: msg('Отмена'),
  role: msg('Роль'),
  userId: msg('ID сотрудника'),
  position: msg('Должность'),
  phoneChanged: msg('Телефон изменён'),
  active: msg('Активна'),
  confirmationNumber: msg('Номер брони'),
  code: msg('Код'),
  checkIn: msg('Заезд'),
  checkOut: msg('Выезд'),
  quantity: msg('Количество'),
  unitPriceMinor: msg('Цена'),
  reason: msg('Причина'),
  note: msg('Комментарий'),
  operationId: msg('ID операции'),
  paymentId: msg('ID оплаты'),
  chargeId: msg('ID начисления'),
  folioId: msg('ID счёта'),
  commissionId: msg('ID комиссии'),
  inviteId: msg('ID приглашения'),
  expectedMinor: msg('По учёту'),
  countedMinor: msg('Пересчитано'),
  actualMinor: msg('Фактически'),
  differenceMinor: msg('Расхождение'),
  amount: msg('Сумма'),
  revenue: msg('Выручка'),
  cost: msg('Себестоимость'),
  restock: msg('Возврат на склад'),
  name: msg('Название'),
  deliveryFailed: msg('Ошибка отправки письма'),
};
const VALUES: Record<string, string> = {
  OWNER: msg('Владелец'),
  MANAGER: msg('Управляющий'),
  STAFF: msg('Администратор'),
  INCOME: msg('Приход'),
  EXPENSE: msg('Расход'),
  TRANSFER: msg('Перевод'),
  CASH: msg('Наличные'),
  CARD: msg('Карта'),
  BANK_TRANSFER: msg('Банковский перевод'),
  KASPI: 'Kaspi',
  COMPLETED: msg('Проведена'),
  VOIDED: msg('Аннулирована'),
  OPEN: msg('Открыт'),
  CLOSED: msg('Закрыт'),
};

export function auditValue(key: string, value: unknown, t: Translate = RU): string {
  if (value === undefined) return t('Не записано');
  if (value === null || value === '') return t('Не указано');
  if (typeof value === 'boolean') return value ? t('Да') : t('Нет');
  if (typeof value !== 'string' && typeof value !== 'number') return t('Нет подробностей');
  const text = String(value);
  if (
    (key.endsWith('Minor') || ['amount', 'revenue', 'cost'].includes(key)) &&
    /^-?\d+$/.test(text)
  )
    return formatMoney(text);
  const known = VALUES[text];
  return known ? t(known) : text;
}

export function OperationDetails({
  before = {},
  after = {},
  t = RU,
}: {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  t?: Translate;
}) {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (key) => LABELS[key],
  );
  if (!keys.length) return null;
  return (
    <details className="journal-details">
      <summary>{t('Подробности операции')}</summary>
      <div className="journal-changes" role="table" aria-label={t('Изменения операции')}>
        <div role="row" className="journal-change">
          <strong role="columnheader">{t('Поле')}</strong>
          <strong role="columnheader">{t('Было')}</strong>
          <strong role="columnheader">{t('Стало')}</strong>
        </div>
        {keys.map((key) => (
          <div role="row" className="journal-change" key={key}>
            <span role="rowheader">{t(LABELS[key]!)}</span>
            <span role="cell">{auditValue(key, before[key], t)}</span>
            <span role="cell">{auditValue(key, after[key], t)}</span>
          </div>
        ))}
      </div>
    </details>
  );
}
