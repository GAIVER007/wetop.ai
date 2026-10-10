'use client';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import { Alert, Button, Field, Input, Select, StatusBadge, Textarea } from '../../components/ui';
import { wholeTenge } from '../../lib/dashboard-format';
import type {
  DiningArea,
  DiningTable,
  FoodEmployee,
  MenuCategory,
  MenuItemView,
  OrderItemInput,
  OrderStatus,
  OrderView,
} from '../../lib/food-types';
import { localInput } from '../beauty/time';
import { mutateOrder } from './restaurant-actions';

export interface OrderContext {
  scopeKey: string;
  timezone: string;
  write: boolean;
  areas: DiningArea[];
  tables: DiningTable[];
  employees: FoodEmployee[];
  categories: MenuCategory[];
  menuItems: MenuItemView[];
}
export type OrderDraft = { kind: 'create'; tableId?: string } | { kind: 'view'; order: OrderView };

const STATUS_ACTION: Record<OrderStatus, string> = {
  NEW: 'Вернуть в новые',
  COOKING: 'Принять в работу',
  READY: 'Готово',
  SERVED: 'Подать',
  CLOSED: 'Оплачен, закрыть',
  CANCELLED: 'Отменить заказ',
};

function ItemsEditor({
  ctx,
  items,
  setItems,
}: {
  ctx: OrderContext;
  items: OrderItemInput[];
  setItems: (items: OrderItemInput[]) => void;
}) {
  const [category, setCategory] = useState('');
  const [dish, setDish] = useState('');
  const dishes = ctx.menuItems.filter(
    (m) => m.active && (!category || m.categoryId === category),
  );
  const byId = new Map(ctx.menuItems.map((m) => [m.id, m]));
  const total = items.reduce(
    (acc, i) => acc + BigInt(byId.get(i.menuItemId)?.priceMinor ?? '0') * BigInt(i.qty),
    0n,
  );
  const change = (index: number, qty: number) => {
    if (qty <= 0) setItems(items.filter((_, i) => i !== index));
    else setItems(items.map((item, i) => (i === index ? { ...item, qty } : item)));
  };
  return (
    <div className="rest-order-items">
      <div className="food-form-row">
        <Field label="Категория">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Все блюда</option>
            {ctx.categories
              .filter((c) => c.active)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Блюдо">
          <Select value={dish} onChange={(e) => setDish(e.target.value)}>
            <option value="">Выберите блюдо</option>
            {dishes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}, {wholeTenge(m.priceMinor, m.currency)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Button
        tone="secondary"
        disabled={!dish}
        onClick={() => {
          if (!dish) return;
          const index = items.findIndex((i) => i.menuItemId === dish);
          if (index >= 0) change(index, items[index]!.qty + 1);
          else setItems([...items, { menuItemId: dish, qty: 1 }]);
          setDish('');
        }}
      >
        Добавить в заказ
      </Button>
      {items.map((item, index) => {
        const m = byId.get(item.menuItemId);
        return (
          <div className="rest-order-item" key={item.menuItemId}>
            <strong>{m?.name ?? 'Блюдо'}</strong>
            <span className="rest-order-qty">
              <Button tone="ghost" aria-label="Меньше" onClick={() => change(index, item.qty - 1)}>
                −
              </Button>
              <span aria-label="Количество">{item.qty}</span>
              <Button tone="ghost" aria-label="Больше" onClick={() => change(index, item.qty + 1)}>
                +
              </Button>
            </span>
            <span className="rest-tech-cost">
              {m ? wholeTenge(String(BigInt(m.priceMinor) * BigInt(item.qty)), m.currency) : '—'}
            </span>
          </div>
        );
      })}
      <div className="rest-order-total">
        <span>Итого</span>
        <strong data-testid="order-draft-total">{wholeTenge(String(total))}</strong>
      </div>
    </div>
  );
}

export function OrderDrawer({
  ctx,
  draft,
  close,
}: {
  ctx: OrderContext;
  draft: OrderDraft;
  close: () => void;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState<OrderView | null>(null);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const initial = draft.kind === 'view' ? draft.order : null;
  const order =
    saved && (!initial || Date.parse(saved.updatedAt) >= Date.parse(initial.updatedAt))
      ? saved
      : initial;
  const [editing, setEditing] = useState(draft.kind === 'create');
  const [tableId, setTableId] = useState(
    draft.kind === 'create' ? (draft.tableId ?? '') : (order?.tableId ?? ''),
  );
  const [waiterId, setWaiterId] = useState(order?.waiter?.id ?? '');
  const [guestCount, setGuestCount] = useState(order?.guestCount ?? 2);
  const [notes, setNotes] = useState(order?.notes ?? '');
  const [items, setItems] = useState<OrderItemInput[]>(
    order?.items
      .filter((i) => i.menuItemId)
      .map((i) => ({ menuItemId: i.menuItemId!, qty: i.qty, notes: i.notes })) ?? [],
  );
  const areaName = useMemo(
    () => new Map(ctx.areas.map((a) => [a.id, a.name])),
    [ctx.areas],
  );
  const tableLabel = (t: DiningTable) => `${areaName.get(t.areaId) ?? ''}, ${t.name}`.replace(/^, /, '');
  const clock = (iso: string | null) => (iso ? localInput(iso, ctx.timezone).slice(11, 16) : '—');
  function submit() {
    setError('');
    start(async () => {
      const body = {
        tableId: tableId || null,
        waiterId: waiterId || null,
        guestCount,
        notes: notes.trim() ? notes.trim() : null,
        items,
      };
      const result = await mutateOrder(
        ctx.scopeKey,
        order
          ? {
              kind: 'edit',
              id: order.id,
              body: {
                expectedStatus: order.status,
                expectedUpdatedAt: order.updatedAt,
                ...body,
              },
            }
          : { kind: 'create', body },
      );
      if (result.error) {
        setError(result.error);
        if (result.stale) router.refresh();
      } else if (result.order) {
        setSaved(result.order);
        setEditing(false);
        router.refresh();
      }
    });
  }
  function transition(status: OrderStatus) {
    if (!order) return;
    setError('');
    start(async () => {
      const result = await mutateOrder(ctx.scopeKey, {
        kind: 'status',
        id: order.id,
        body: {
          expectedStatus: order.status,
          expectedUpdatedAt: order.updatedAt,
          status,
        },
      });
      if (result.error) {
        setError(result.error);
        if (result.stale) router.refresh();
      } else if (result.order) {
        setSaved(result.order);
        router.refresh();
      }
    });
  }
  const title = order ? `Заказ №${order.number}` : 'Новый заказ';
  const itemsEditable = !order || order.status === 'NEW' || order.status === 'COOKING';
  return (
    <Overlay open onClose={close} title={title} drawer className="food-drawer" trapFocus>
      <div className="food-detail" data-testid="order-drawer">
        {error && <Alert>{error}</Alert>}
        {order && !editing ? (
          <>
            <div className="food-section-heading">
              <StatusBadge kind="foodOrder" value={order.status} />
              {order.delayed && <span className="warn-text">Задерживается</span>}
            </div>
            <dl>
              <dt>Стол</dt>
              <dd>{order.table ? `${order.table.areaName}, ${order.table.name}` : 'Без стола'}</dd>
              <dt>Официант</dt>
              <dd>{order.waiter?.name ?? '—'}</dd>
              <dt>Гостей</dt>
              <dd>{order.guestCount}</dd>
              <dt>Открыт</dt>
              <dd>{clock(order.openedAt)}</dd>
              {order.closedAt && (
                <>
                  <dt>Закрыт</dt>
                  <dd>{clock(order.closedAt)}</dd>
                </>
              )}
              {order.notes && (
                <>
                  <dt>Комментарий</dt>
                  <dd>{order.notes}</dd>
                </>
              )}
            </dl>
            <div className="rest-order-items">
              {order.items.map((i) => (
                <div className="rest-order-item" key={i.id}>
                  <strong>
                    {i.name}
                    {i.notes ? <small>, {i.notes}</small> : null}
                  </strong>
                  <span>× {i.qty}</span>
                  <span className="rest-tech-cost">
                    {wholeTenge(String(BigInt(i.priceMinor) * BigInt(i.qty)), order.currency)}
                  </span>
                </div>
              ))}
              <div className="rest-order-total">
                <span>Итого</span>
                <strong data-testid="order-total">
                  {wholeTenge(order.totalMinor, order.currency)}
                </strong>
              </div>
            </div>
            {ctx.write && (
              <div className="food-actions">
                {order.nextStatuses
                  .filter((s) => s !== 'CANCELLED')
                  .map((s) => (
                    <Button key={s} disabled={pending} onClick={() => transition(s)}>
                      {STATUS_ACTION[s]}
                    </Button>
                  ))}
                {itemsEditable && (
                  <Button tone="secondary" disabled={pending} onClick={() => setEditing(true)}>
                    Изменить
                  </Button>
                )}
                {order.nextStatuses.includes('CANCELLED') && (
                  <Button tone="danger" disabled={pending} onClick={() => transition('CANCELLED')}>
                    {STATUS_ACTION.CANCELLED}
                  </Button>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="food-form-row">
              <Field label="Стол">
                <Select value={tableId} onChange={(e) => setTableId(e.target.value)}>
                  <option value="">Без стола</option>
                  {ctx.tables
                    .filter((t) => t.active)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {tableLabel(t)}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Официант">
                <Select value={waiterId} onChange={(e) => setWaiterId(e.target.value)}>
                  <option value="">Не назначен</option>
                  {ctx.employees
                    .filter((e) => e.status === 'ACTIVE')
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                </Select>
              </Field>
            </div>
            <Field label="Гостей">
              <Input
                type="number"
                min={1}
                max={1000}
                value={guestCount}
                onChange={(e) => setGuestCount(Math.max(1, Number(e.target.value) || 1))}
              />
            </Field>
            {itemsEditable ? (
              <ItemsEditor ctx={ctx} items={items} setItems={setItems} />
            ) : (
              <p className="muted">Состав заморожен после готовности.</p>
            )}
            <Field label="Комментарий">
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <div className="food-actions">
              <Button disabled={pending || items.length === 0} onClick={submit}>
                {order ? 'Сохранить' : 'Создать заказ'}
              </Button>
              <Button
                tone="secondary"
                disabled={pending}
                onClick={() => (order ? setEditing(false) : close())}
              >
                Отмена
              </Button>
            </div>
          </>
        )}
      </div>
    </Overlay>
  );
}
