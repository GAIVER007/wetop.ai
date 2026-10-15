import { formatMoney } from '../../lib/money';

const LABELS: Record<string, string> = {
  amountMinor: 'Сумма',
  commissionMinor: 'Комиссия',
  kind: 'Операция',
  method: 'Способ оплаты',
  methodTo: 'Куда переведено',
  category: 'Статья',
  status: 'Статус',
  voided: 'Отмена',
  role: 'Роль',
  userId: 'ID сотрудника',
  position: 'Должность',
  phoneChanged: 'Телефон изменён',
  active: 'Активна',
  confirmationNumber: 'Номер брони',
  code: 'Код',
  checkIn: 'Заезд',
  checkOut: 'Выезд',
  quantity: 'Количество',
  unitPriceMinor: 'Цена',
  reason: 'Причина',
  note: 'Комментарий',
  operationId: 'ID операции',
  paymentId: 'ID оплаты',
  chargeId: 'ID начисления',
  folioId: 'ID счёта',
  commissionId: 'ID комиссии',
  inviteId: 'ID приглашения',
  expectedMinor: 'По учёту',
  countedMinor: 'Пересчитано',
  actualMinor: 'Фактически',
  differenceMinor: 'Расхождение',
  amount: 'Сумма',
  revenue: 'Выручка',
  cost: 'Себестоимость',
  restock: 'Возврат на склад',
  name: 'Название',
  deliveryFailed: 'Ошибка отправки письма',
};
const VALUES: Record<string, string> = {
  OWNER: 'Владелец',
  MANAGER: 'Управляющий',
  STAFF: 'Администратор',
  INCOME: 'Приход',
  EXPENSE: 'Расход',
  TRANSFER: 'Перевод',
  CASH: 'Наличные',
  CARD: 'Карта',
  BANK_TRANSFER: 'Банковский перевод',
  KASPI: 'Kaspi',
  COMPLETED: 'Проведена',
  VOIDED: 'Аннулирована',
  OPEN: 'Открыт',
  CLOSED: 'Закрыт',
};

export function auditValue(key: string, value: unknown): string {
  if (value === undefined) return 'Не записано';
  if (value === null || value === '') return 'Не указано';
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  if (typeof value !== 'string' && typeof value !== 'number') return 'Нет подробностей';
  const text = String(value);
  if (
    (key.endsWith('Minor') || ['amount', 'revenue', 'cost'].includes(key)) &&
    /^-?\d+$/.test(text)
  )
    return formatMoney(text);
  return VALUES[text] ?? text;
}

export function OperationDetails({
  before = {},
  after = {},
}: {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}) {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (key) => LABELS[key],
  );
  if (!keys.length) return null;
  return (
    <details className="journal-details">
      <summary>Подробности операции</summary>
      <div className="journal-changes" role="table" aria-label="Изменения операции">
        <div role="row" className="journal-change">
          <strong role="columnheader">Поле</strong>
          <strong role="columnheader">Было</strong>
          <strong role="columnheader">Стало</strong>
        </div>
        {keys.map((key) => (
          <div role="row" className="journal-change" key={key}>
            <span role="rowheader">{LABELS[key]}</span>
            <span role="cell">{auditValue(key, before[key])}</span>
            <span role="cell">{auditValue(key, after[key])}</span>
          </div>
        ))}
      </div>
    </details>
  );
}
