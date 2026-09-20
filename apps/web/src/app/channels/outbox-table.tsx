import Link from 'next/link';
import type { OutboxRow, OutboxRowStatus } from '../../lib/api';
import { Badge, Table } from '../../components/ui';
import { displayPeriod, displayDay } from '../../lib/display-date';
import { almatyDateTime } from './format';

const KIND_RU: Record<OutboxRow['kind'], string> = {
  AVAILABILITY: 'остатки',
  RESTRICTIONS: 'цены и ограничения',
};
const STATUS_RU: Record<OutboxRowStatus, string> = {
  PENDING: 'ждёт',
  SENT: 'отправлено',
  FAILED: 'ошибка',
};
const STATUS_TONE: Record<OutboxRowStatus, 'info' | 'ok' | 'danger'> = {
  PENDING: 'info',
  SENT: 'ok',
  FAILED: 'danger',
};
export const OUTBOX_FILTERS: Array<[OutboxRowStatus | '', string]> = [
  ['', 'все'],
  ['PENDING', 'ждёт'],
  ['FAILED', 'ошибка'],
];

/**
 * Очередь в Channex (срез 7.2, макет «Integration»): что ушло, по каким категориям, на какие даты,
 * статус словом. Действие, породившее строку, не хранится — его ищут в журнале (`/journal`), развилка 7.2-3.
 */
export function OutboxTable({
  rows,
  filter,
  hrefFor,
  categoryName,
}: {
  rows: OutboxRow[] | null;
  filter: OutboxRowStatus | '';
  hrefFor: (status: OutboxRowStatus | '') => string;
  categoryName: (code: string) => string;
}) {
  return (
    <div className="stack stack--sm">
      <div className="row row--inline filters" role="group" aria-label="Очередь: фильтр по статусу">
        {OUTBOX_FILTERS.map(([value, label]) => (
          <Link
            key={value}
            href={hrefFor(value)}
            className={`filter-chip${filter === value ? ' is-selected' : ''}`}
            aria-current={filter === value ? 'true' : undefined}
            data-testid={`outbox-filter-${value || 'all'}`}
          >
            {label}
          </Link>
        ))}
      </div>
      <Table size="sm" className="dir-table dir-table--outbox" data-testid="outbox-table">
        <thead>
          <tr>
            {['Что', 'Категории', 'Даты', 'Статус', 'Попыток', 'Task id', 'Создано'].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows === null && (
            <tr>
              <td colSpan={7} className="empty-state" data-testid="outbox-rows-failed">
                Строки очереди не загрузились: API не ответил. Числа в плитках выше читаются
                отдельно; обновите страницу или откройте{' '}
                <Link href="/incidents">неисправности</Link>.
              </td>
            </tr>
          )}
          {rows?.length === 0 && (
            <tr>
              <td colSpan={7} className="empty-state" data-testid="outbox-empty">
                {filter ? (
                  <>
                    Строк со статусом «{STATUS_RU[filter]}» нет.{' '}
                    <Link href={hrefFor('')}>Показать все строки</Link>
                  </>
                ) : (
                  'Очередь пуста: все изменения цен и остатков уже ушли в Channex. Новая строка появится после правки цены, брони или блокировки.'
                )}
              </td>
            </tr>
          )}
          {rows?.map((r) => (
            <tr key={r.id} data-testid="outbox-row">
              <td>
                {KIND_RU[r.kind]}
                <div className="cell-sub">сообщений: {r.messages}</div>
              </td>
              <td>{r.roomTypes.map(categoryName).join(', ') || '—'}</td>
              <td className="nowrap">
                {r.dateFrom && r.dateTo
                  ? r.dateFrom === r.dateTo
                    ? displayDay(r.dateFrom)
                    : displayPeriod(r.dateFrom, r.dateTo)
                  : '—'}
              </td>
              <td>
                <Badge tone={STATUS_TONE[r.status]}>{STATUS_RU[r.status]}</Badge>
                {r.lastError && <div className="cell-sub danger-text">{r.lastError}</div>}
              </td>
              <td className="num">{r.attempts}</td>
              <td className="mono break-all">{r.taskId ?? '—'}</td>
              <td className="nowrap">{almatyDateTime(r.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
