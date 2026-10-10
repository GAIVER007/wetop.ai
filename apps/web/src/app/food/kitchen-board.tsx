'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Badge, Button } from '../../components/ui';
import type { OrderStatus, OrderView } from '../../lib/food-types';
import { localInput } from '../beauty/time';
import { mutateOrder } from './restaurant-actions';

const COLUMNS = [
  { id: 'NEW', title: 'Новые', action: 'COOKING' as OrderStatus, button: 'Принять' },
  { id: 'COOKING', title: 'В работе', action: 'READY' as OrderStatus, button: 'Готово' },
  { id: 'READY', title: 'Готово', action: 'SERVED' as OrderStatus, button: 'Подать' },
] as const;

function minutesAgo(iso: string, now: number) {
  return Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
}

/** Экран кухни (KDS) по макету: Новые, В работе, Готово, Задерживаются; обновляется раз в 30 секунд */
export function KitchenBoard({
  scopeKey,
  timezone,
  write,
  orders,
}: {
  scopeKey: string;
  timezone: string;
  write: boolean;
  orders: OrderView[];
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
      router.refresh();
    }, 30000);
    return () => clearInterval(timer);
  }, [router]);
  const clock = (iso: string) => localInput(iso, timezone).slice(11, 16);
  const delayed = orders.filter((o) => o.delayed);
  function transition(order: OrderView, status: OrderStatus) {
    setError('');
    start(async () => {
      const result = await mutateOrder(scopeKey, {
        kind: 'status',
        id: order.id,
        body: {
          expectedStatus: order.status,
          expectedUpdatedAt: order.updatedAt,
          status,
        },
      });
      if (result.error) setError(result.error);
      router.refresh();
    });
  }
  const card = (o: OrderView, action?: { status: OrderStatus; button: string }) => (
    <article
      className="rest-kds-card"
      data-status={o.status}
      data-delayed={o.delayed || undefined}
      key={o.id}
    >
      <div className="rest-kds-head">
        <strong>{o.table ? `Стол ${o.table.name}` : `Заказ №${o.number}`}</strong>
        <small>
          {clock(o.openedAt)}, №{o.number}
        </small>
      </div>
      <ul className="rest-kds-items">
        {o.items.map((i) => (
          <li key={i.id}>
            {i.name} ×{i.qty}
            {i.notes ? `, ${i.notes}` : ''}
          </li>
        ))}
      </ul>
      <small>{minutesAgo(o.openedAt, now)} мин в работе</small>
      {o.delayed && <Badge tone="danger">Задерживается</Badge>}
      {write && action && (
        <Button disabled={pending} onClick={() => transition(o, action.status)}>
          {action.button}
        </Button>
      )}
    </article>
  );
  return (
    <div className="food-workspace" data-testid="kitchen-board">
      {error && <Alert>{error}</Alert>}
      <div className="rest-kds">
          {COLUMNS.map((col) => {
            const list = orders.filter((o) => o.status === col.id);
            return (
              <section className="rest-kds-col" key={col.id} aria-label={col.title}>
                <h2>
                  {col.title} <Badge>{list.length}</Badge>
                </h2>
                {list.map((o) => card(o, { status: col.action, button: col.button }))}
                {list.length === 0 && <p className="muted">Пусто</p>}
              </section>
            );
          })}
          <section className="rest-kds-col" aria-label="Задерживаются">
            <h2>
              Задерживаются <Badge tone={delayed.length ? 'danger' : 'neutral'}>{delayed.length}</Badge>
            </h2>
            {delayed.map((o) =>
              card(
                o,
                o.status === 'NEW'
                  ? { status: 'COOKING', button: 'Принять' }
                  : { status: 'READY', button: 'Готово' },
              ),
            )}
            {delayed.length === 0 && <p className="muted">Кухня успевает</p>}
          </section>
      </div>
    </div>
  );
}
