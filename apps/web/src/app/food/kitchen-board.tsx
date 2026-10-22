'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Badge, Button } from '../../components/ui';
import type { MenuStation, OrderItemStatus, OrderItemView, OrderView } from '../../lib/food-types';
import { localInput } from '../beauty/time';
import { stationLines } from '../../lib/food-stations';
import { mutateOrder } from './restaurant-actions';

const COLUMNS: ReadonlyArray<{ id: OrderItemStatus; title: string; action: OrderItemStatus; button: string }> = [
  { id: 'NEW', title: 'Новые', action: 'COOKING', button: 'Принять' },
  { id: 'COOKING', title: 'Готовятся', action: 'READY', button: 'Готово' },
  { id: 'READY', title: 'Готово', action: 'SERVED', button: 'Отметить как выдано' },
];
/** Автообновление: новые позиции от официантов появляются без перезагрузки (§33.6) */
const REFRESH_MS = 15_000;

function minutesAgo(iso: string, now: number) {
  return Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
}

/**
 * Экран станции (KDS) по позициям (§33.6, макет экрана 6): кухня видит только позиции KITCHEN, бар только BAR. Колонки
 * Новые, Готовятся, Готово, Задерживаются; карточка заказа держит позиции этой колонки, у каждой своя кнопка
 * «Принять / Готово / Отметить как выдано». Обновляется каждые 15 секунд.
 */
export function KitchenBoard({
  scopeKey,
  timezone,
  write,
  orders,
  station = 'KITCHEN',
}: {
  scopeKey: string;
  timezone: string;
  write: boolean;
  orders: OrderView[];
  station?: MenuStation;
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
      router.refresh();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [router]);
  const clock = (iso: string) => localInput(iso, timezone).slice(11, 16);
  const mine = orders.filter((o) => stationLines(o, station).length > 0);
  const late = (o: OrderView) => o.delayed && stationLines(o, station).some((i) => (i.status ?? 'NEW') !== 'READY');
  function transition(order: OrderView, item: OrderItemView, status: OrderItemStatus) {
    setError('');
    start(async () => {
      const result = await mutateOrder(scopeKey, {
        kind: 'item-status',
        id: order.id,
        itemId: item.id,
        body: { status, expectedUpdatedAt: order.updatedAt },
      });
      if (result.error) setError(result.error);
      router.refresh();
    });
  }
  const card = (o: OrderView, lines: OrderItemView[], col: OrderItemStatus | 'DELAYED') => (
    <article
      className="rest-kds-card"
      data-status={col === 'DELAYED' ? (lines[0]?.status ?? 'NEW') : col}
      data-delayed={col === 'DELAYED' || undefined}
      key={o.id}
    >
      <div className="rest-kds-head">
        <strong>№{o.number}</strong>
        <time dateTime={o.openedAt} data-late={o.delayed || undefined}>
          {clock(o.openedAt)}
        </time>
      </div>
      <span className="rest-kds-table">
        {o.table ? `Стол ${o.table.name}` : 'Без стола'}
        {o.waiter ? `, ${o.waiter.name}` : ''}
      </span>
      <ul className="rest-kds-items">
        {lines.map((i) => {
          const status = i.status ?? 'NEW';
          const action = COLUMNS.find((c) => c.id === status)!;
          return (
            <li key={i.id} data-status={status} data-testid="kds-line">
              <span className="rest-kds-line">
                <span>
                  {i.name}
                  {i.notes && <small>{i.notes}</small>}
                </span>
                <b>×{i.qty}</b>
              </span>
              {write && (
                <Button
                  size="sm"
                  tone={status === 'COOKING' ? 'primary' : 'secondary'}
                  disabled={pending}
                  aria-label={`${action.button}: ${i.name}`}
                  onClick={() => transition(o, i, action.action)}
                >
                  {action.button}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <small className="muted">{minutesAgo(o.openedAt, now)} мин в работе</small>
      {col === 'DELAYED' && <Badge tone="danger">Задерживается</Badge>}
    </article>
  );
  const delayed = mine.filter(late);
  return (
    <div className="food-workspace" data-testid={station === 'BAR' ? 'bar-kds' : 'kitchen-board'}>
      {error && <Alert>{error}</Alert>}
      <div className="rest-kds">
        {COLUMNS.map((col) => {
          const list = mine
            .filter((o) => !delayed.includes(o) || col.id === 'READY')
            .map((o) => [o, stationLines(o, station).filter((i) => (i.status ?? 'NEW') === col.id)] as const)
            .filter(([, lines]) => lines.length > 0);
          return (
            <section className="rest-kds-col" data-col={col.id} key={col.id} aria-label={col.title}>
              <h2>
                {col.title} ({list.length})
              </h2>
              {list.map(([o, lines]) => card(o, lines, col.id))}
              {list.length === 0 && <p className="muted">Пусто</p>}
            </section>
          );
        })}
        <section className="rest-kds-col" data-col="DELAYED" aria-label="Задерживаются">
          <h2>Задерживаются ({delayed.length})</h2>
          {delayed.map((o) =>
            card(
              o,
              stationLines(o, station).filter((i) => (i.status ?? 'NEW') !== 'READY'),
              'DELAYED',
            ),
          )}
          {delayed.length === 0 && <p className="muted">{station === 'BAR' ? 'Бар успевает' : 'Кухня успевает'}</p>}
        </section>
      </div>
    </div>
  );
}
