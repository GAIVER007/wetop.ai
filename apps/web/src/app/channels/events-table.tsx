import Link from 'next/link';
import type { InboundEvent } from '../../lib/api';
import { Badge, Button, Input, Select, Table } from '../../components/ui';
import { Icon } from '../../components/icon';
import { RetryEventButton } from './buttons';
import {
  EVENT_STATUS_RU,
  EVENT_STATUS_TONE,
  EVENT_TYPE_RU,
  VIA_RU,
  almatyDateTime,
} from './format';

export interface EventsFilter {
  status: string;
  type: string;
  q: string;
  page: number;
}
export const EVENTS_PAGE = 20;

/**
 * Входящие события канала (срез 7.2, макет «Integration»): фильтры по статусу и типу, поиск по номеру
 * брони или `unique_id`, постраничность «показано 20 из 312», колонка «Бронь» ведёт на карточку,
 * событие — на страницу приёма брони.
 */
export function EventsTable({
  data,
  filter,
  hrefFor,
  queueFilter,
}: {
  data: { rows: InboundEvent[]; total: number } | null;
  filter: EventsFilter;
  hrefFor: (f: Partial<EventsFilter>) => string;
  /** сохраняем фильтр очереди в форме поиска, чтобы GET не сбрасывал вторую таблицу */
  queueFilter: string;
}) {
  const shown = data?.rows.length ?? 0;
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / EVENTS_PAGE));
  const failed = data?.rows.find((e) => e.status === 'FAILED' && e.lastError);
  return (
    <div className="stack stack--sm">
      <form method="get" action="/channels" className="row row--inline filters" role="search">
        {queueFilter && <input type="hidden" name="queue" value={queueFilter} />}
        <Select
          name="status"
          defaultValue={filter.status}
          aria-label="Статус события"
          className="filter-chip"
        >
          <option value="">все статусы</option>
          <option value="PROCESSED">обработано</option>
          <option value="FAILED">ошибка</option>
          <option value="RECEIVED">получено</option>
          <option value="PROCESSING">в работе</option>
        </Select>
        <Select
          name="type"
          defaultValue={filter.type}
          aria-label="Тип события"
          className="filter-chip"
        >
          <option value="">все типы</option>
          <option value="booking_new">новая бронь</option>
          <option value="booking_modification">изменение</option>
          <option value="booking_cancellation">отмена</option>
        </Select>
        <label className="search-field">
          <Icon name="search" width={16} height={16} />
          <Input
            name="q"
            defaultValue={filter.q}
            placeholder="номер брони"
            aria-label="Поиск по номеру брони или unique_id"
            data-testid="events-search"
          />
        </label>
        <Button type="submit" tone="secondary" size="sm">
          Найти
        </Button>
      </form>
      {failed && (
        <div className="callout callout--warn" data-testid="events-callout">
          <Icon name="incidents" width={16} height={16} />
          <span>
            <b>Входящая бронь требует разбора.</b> {failed.lastError} Порядок разбора — CUTOVER.md,
            «Процедура на канал».
          </span>
          <RetryEventButton revisionId={failed.externalEventId} />
        </div>
      )}
      <Table size="sm" className="dir-table dir-table--events" data-testid="events-table">
        <thead>
          <tr>
            {['Событие', 'Тип', 'Как дошло', 'Статус', 'Получено', 'Бронь', ''].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data === null && (
            <tr>
              <td colSpan={7} className="empty-state" data-testid="events-failed">
                События не загрузились: API не ответил. Брони из каналов при этом принимаются
                отдельно; обновите страницу или откройте{' '}
                <Link href="/incidents">неисправности</Link>.
              </td>
            </tr>
          )}
          {data?.rows.length === 0 && (
            <tr>
              <td colSpan={7} className="empty-state" data-testid="events-empty">
                {filter.q || filter.status || filter.type ? (
                  <>
                    По этим условиям ничего не найдено.{' '}
                    <Link href={hrefFor({ q: '', status: '', type: '', page: 1 })}>
                      Сбросить фильтры событий
                    </Link>
                  </>
                ) : (
                  'Событий пока нет: Channex ещё не присылал броней. Когда пришлёт, событие появится здесь, а бронь — на шахматке.'
                )}
              </td>
            </tr>
          )}
          {data?.rows.map((e) => (
            <tr key={e.externalEventId} data-testid="event-row">
              <td>
                <Link
                  href={`/channels/events/${encodeURIComponent(e.externalEventId)}`}
                  className="mono"
                >
                  {e.externalEventId.slice(0, 36)}
                </Link>
                {e.otaName && <div className="cell-sub">{e.otaName}</div>}
              </td>
              <td>{EVENT_TYPE_RU[e.type] ?? e.type}</td>
              <td>{VIA_RU[e.receivedVia ?? 'PULL'] ?? e.receivedVia}</td>
              <td>
                <Badge tone={EVENT_STATUS_TONE[e.status] ?? 'neutral'}>
                  {EVENT_STATUS_RU[e.status] ?? e.status}
                </Badge>
                <div className="cell-sub">попыток: {e.attempts}</div>
              </td>
              <td className="nowrap">{almatyDateTime(e.receivedAt)}</td>
              <td>
                {e.confirmationNumber ? (
                  <Link
                    href={`/reservations/${encodeURIComponent(e.confirmationNumber)}`}
                    className="bold"
                  >
                    {e.confirmationNumber}
                  </Link>
                ) : (
                  <span className="muted mono">{e.uniqueId ?? '—'}</span>
                )}
              </td>
              <td>
                {e.status === 'FAILED' && <RetryEventButton revisionId={e.externalEventId} />}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <div className="row row--between pager" data-testid="events-pager">
        <span className="muted">{total > 0 ? `показано ${shown} из ${total}` : ''}</span>
        {pages > 1 && (
          <span className="row row--inline">
            {filter.page > 1 ? (
              <Link
                href={hrefFor({ page: filter.page - 1 })}
                className="btn btn--secondary btn--sm"
              >
                Назад
              </Link>
            ) : (
              <span className="btn btn--secondary btn--sm is-disabled" aria-disabled="true">
                Назад
              </span>
            )}
            <span className="muted">
              страница {filter.page} из {pages}
            </span>
            {filter.page < pages ? (
              <Link
                href={hrefFor({ page: filter.page + 1 })}
                className="btn btn--secondary btn--sm"
              >
                Дальше
              </Link>
            ) : (
              <span className="btn btn--secondary btn--sm is-disabled" aria-disabled="true">
                Дальше
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
