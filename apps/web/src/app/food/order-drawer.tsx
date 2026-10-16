'use client';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import { IconField } from '../../components/icon-field';
import { Icon } from '../../components/icon';
import { Alert, Button, Field, Input, Select, StatusBadge, Textarea } from '../../components/ui';
import { METHOD_RU, wholeTenge } from '../../lib/dashboard-format';
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
import { FOOD_PAYMENT_METHODS, type FoodPaymentMethod } from '../../lib/food-types';
import { localInput } from '../beauty/time';
import { mutateOrder, orderRatingLink } from './restaurant-actions';
import { useConfirm } from '../../components/use-confirm';
import { QrCode, StarsInput } from './rating-parts';

export interface OrderContext {
  scopeKey: string;
  timezone: string;
  write: boolean;
  /** Аннулировать платёж (право `refunds`, §35.1) */
  refunds: boolean;
  areas: DiningArea[];
  tables: DiningTable[];
  employees: FoodEmployee[];
  categories: MenuCategory[];
  menuItems: MenuItemView[];
}
export type OrderDraft =
  | { kind: 'create'; tableId?: string; items?: OrderItemInput[] }
  | { kind: 'view'; order: OrderView };

const STATUS_ACTION: Record<OrderStatus, string> = {
  NEW: 'Вернуть в новые',
  COOKING: 'Принять в работу',
  READY: 'Готово',
  SERVED: 'Подать',
  CLOSED: 'Закрыть заказ',
  CANCELLED: 'Отменить заказ',
};

/** Оценка гостя после оплаты (§39): гость сам ставит 1–5 звёзд на устройстве смены, оценка не правится */
function RatingPanel({
  ctx,
  order,
  onSaved,
}: {
  ctx: OrderContext;
  order: OrderView;
  onSaved: (order: OrderView) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  if (order.status !== 'CLOSED') return null;
  if (order.rating)
    return (
      <section className="rest-rating" aria-label="Оценка гостя" data-testid="order-rating">
        <span className="rest-stars" aria-label={`Оценка ${order.rating.stars} из 5`}>
          {'★'.repeat(order.rating.stars)}
          {'☆'.repeat(5 - order.rating.stars)}
        </span>
        {order.rating.comment && <p>{order.rating.comment}</p>}
      </section>
    );
  if (!ctx.write) return null;
  function send() {
    if (!stars) return setError('Выберите от 1 до 5 звёзд');
    start(async () => {
      const result = await mutateOrder(ctx.scopeKey, {
        kind: 'rate',
        id: order.id,
        body: { stars, comment: comment.trim() || null },
      });
      if (result.error) setError(result.error);
      else if (result.order) {
        setError('');
        onSaved(result.order);
        router.refresh();
      }
    });
  }
  function qr() {
    start(async () => {
      const result = await orderRatingLink(ctx.scopeKey, order.id);
      if (result.error || !result.token) return setError(result.error ?? 'Ссылка не выдана');
      setError('');
      setLink({ url: `${window.location.origin}/rate/${result.token}`, expiresAt: result.expiresAt ?? '' });
    });
  }
  return (
    <section className="rest-rating" aria-label="Оцените обслуживание" data-testid="order-rating">
      {error && <Alert>{error}</Alert>}
      <strong>Оцените обслуживание{order.waiter ? `: ${order.waiter.name}` : ''}</strong>
      <StarsInput value={stars} onChange={setStars} />
      <Field label="Комментарий гостя">
        <Input value={comment} maxLength={500} onChange={(e) => setComment(e.target.value)} />
      </Field>
      <Button disabled={pending} onClick={send}>
        Отправить оценку
      </Button>
      {link ? (
        <div className="rest-qr-box" data-testid="order-rating-qr">
          <QrCode text={link.url} label="QR-код: оценка с телефона гостя" />
          <p className="muted">
            Гость наводит камеру и ставит оценку сам. Ссылка одна на заказ и действует 72 часа.
          </p>
          <a href={link.url} target="_blank" rel="noreferrer" className="rest-qr-link">
            {link.url}
          </a>
        </div>
      ) : (
        <Button tone="secondary" disabled={pending} onClick={qr}>
          QR-код для гостя
        </Button>
      )}
    </section>
  );
}

/** Оплата заказа частями и разными способами (§35.1): остаток, платежи, аннулирование */
function PaymentPanel({
  ctx,
  order,
  onSaved,
}: {
  ctx: OrderContext;
  order: OrderView;
  onSaved: (order: OrderView) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const remaining = BigInt(order.totalMinor) - BigInt(order.paidMinor);
  const [method, setMethod] = useState<FoodPaymentMethod>('CASH');
  const [amount, setAmount] = useState(String(remaining / 100n));
  const [voiding, setVoiding] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const open = order.status !== 'CLOSED' && order.status !== 'CANCELLED';
  // возврат по закрытому заказу (§56): не больше чистой оплаты, право `refunds`
  const net = BigInt(order.paidMinor) - BigInt(order.refundedMinor);
  const refundable = ctx.refunds && order.status === 'CLOSED' && net > 0n;
  const [refundMethod, setRefundMethod] = useState<FoodPaymentMethod>('CASH');
  const [refundAmount, setRefundAmount] = useState(String(net / 100n));
  const [refundReason, setRefundReason] = useState('');
  function refund() {
    const tenge = Number(refundAmount);
    if (!Number.isInteger(tenge) || tenge <= 0) return setError('Сумма в тенге, целое число больше нуля');
    if (!refundReason.trim()) return setError('Укажите причину возврата');
    start(async () =>
      done(
        await mutateOrder(ctx.scopeKey, {
          kind: 'refund',
          id: order.id,
          body: { method: refundMethod, amount: tenge * 100, reason: refundReason.trim(), idempotencyKey: crypto.randomUUID() },
        }),
      ),
    );
  }
  const done = (result: { error: string | null; stale?: boolean; order?: OrderView }) => {
    if (result.error) {
      setError(result.error);
      if (result.stale) router.refresh();
    } else if (result.order) {
      setError('');
      setVoiding(null);
      setReason('');
      setAmount(String((BigInt(result.order.totalMinor) - BigInt(result.order.paidMinor)) / 100n));
      setRefundAmount(String((BigInt(result.order.paidMinor) - BigInt(result.order.refundedMinor)) / 100n));
      setRefundReason('');
      onSaved(result.order);
      router.refresh();
    }
  };
  function pay() {
    const tenge = Number(amount);
    if (!Number.isInteger(tenge) || tenge <= 0) return setError('Сумма в тенге, целое число больше нуля');
    start(async () =>
      done(
        await mutateOrder(ctx.scopeKey, {
          kind: 'pay',
          id: order.id,
          body: { method, amount: tenge * 100, idempotencyKey: crypto.randomUUID() },
        }),
      ),
    );
  }
  function voidPayment(id: string) {
    if (!reason.trim()) return setError('Укажите причину аннулирования');
    start(async () =>
      done(await mutateOrder(ctx.scopeKey, { kind: 'void-payment', id, reason: reason.trim() })),
    );
  }
  return (
    <section className="rest-pay" aria-label="Оплата заказа" data-testid="order-payment">
      {error && <Alert>{error}</Alert>}
      <dl className="rest-pay-sum">
        <dt>Оплачено</dt>
        <dd data-testid="order-paid">{wholeTenge(order.paidMinor, order.currency)}</dd>
        <dt>Осталось</dt>
        <dd data-testid="order-remaining">{wholeTenge(String(remaining), order.currency)}</dd>
        {BigInt(order.refundedMinor) > 0n && (
          <>
            <dt>Возвращено</dt>
            <dd data-testid="order-refunded">{wholeTenge(order.refundedMinor, order.currency)}</dd>
          </>
        )}
      </dl>
      {order.payments.length > 0 && (
        <ul className="rest-pay-list">
          {order.payments.map((p) => (
            <li key={p.id} data-status={p.status}>
              <span>{METHOD_RU[p.method] ?? p.method}</span>
              <strong>{wholeTenge(p.amountMinor, order.currency)}</strong>
              {p.status === 'VOIDED' ? (
                <small>Аннулирован{p.voidReason ? `: ${p.voidReason}` : ''}</small>
              ) : (
                ctx.refunds &&
                open &&
                (voiding === p.id ? (
                  <span className="rest-pay-void">
                    <Input
                      aria-label="Причина аннулирования"
                      placeholder="Причина"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <Button tone="danger" disabled={pending} onClick={() => voidPayment(p.id)}>
                      Аннулировать
                    </Button>
                  </span>
                ) : (
                  <Button tone="secondary" disabled={pending} onClick={() => setVoiding(p.id)}>
                    Аннулировать
                  </Button>
                ))
              )}
            </li>
          ))}
        </ul>
      )}
      {ctx.write && open && remaining > 0n && (
        <div className="food-form-row">
          <Field label="Способ">
            <Select value={method} onChange={(e) => setMethod(e.target.value as FoodPaymentMethod)}>
              {FOOD_PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {METHOD_RU[m] ?? m}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Сумма, ₸">
            <Input
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
          <Button disabled={pending} onClick={pay}>
            Принять оплату
          </Button>
        </div>
      )}
      {open && remaining === 0n && order.status !== 'SERVED' && (
        <p className="muted">Оплачено полностью: заказ закроется сам, когда его подадут.</p>
      )}
      {refundable && (
        <section className="food-form" aria-label="Возврат по заказу">
          <div className="food-form-row">
            <Field label="Способ возврата">
              <Select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value as FoodPaymentMethod)}>
                {FOOD_PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {METHOD_RU[m] ?? m}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Сумма возврата, ₸">
              <Input inputMode="numeric" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value.replace(/\D/g, ''))} />
            </Field>
          </div>
          <Field label="Причина возврата">
            <Input value={refundReason} maxLength={300} onChange={(e) => setRefundReason(e.target.value)} />
          </Field>
          <Button tone="danger" disabled={pending} onClick={refund}>
            Оформить возврат
          </Button>
        </section>
      )}
    </section>
  );
}

/** Выбор блюд по макету POS (экран 5): вкладки категорий, поиск, плитки с фото и ценой; щелчок добавляет порцию */
function DishPicker({
  ctx,
  items,
  setItems,
}: {
  ctx: OrderContext;
  items: OrderItemInput[];
  setItems: (items: OrderItemInput[]) => void;
}) {
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const q = query.trim().toLocaleLowerCase('ru');
  const dishes = ctx.menuItems.filter(
    (m) =>
      m.active &&
      (!category || m.categoryId === category) &&
      (!q || m.name.toLocaleLowerCase('ru').includes(q)),
  );
  const add = (id: string) => {
    const index = items.findIndex((i) => i.menuItemId === id);
    if (index >= 0)
      setItems(items.map((item, i) => (i === index ? { ...item, qty: item.qty + 1 } : item)));
    else setItems([...items, { menuItemId: id, qty: 1 }]);
  };
  return (
    <div className="rest-pos-menu">
      <nav className="rest-utabs" aria-label="Категории меню">
        <button type="button" aria-current={!category ? 'page' : undefined} onClick={() => setCategory('')}>
          Все блюда
        </button>
        {ctx.categories
          .filter((c) => c.active)
          .map((c) => (
            <button
              key={c.id}
              type="button"
              aria-current={category === c.id ? 'page' : undefined}
              onClick={() => setCategory(c.id)}
            >
              {c.name}
            </button>
          ))}
      </nav>
      <Field label={<span className="sr-only">Поиск блюда</span>}>
        <IconField icon="search">
          <Input
            type="search"
            placeholder="Поиск блюда"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </IconField>
      </Field>
      {dishes.length === 0 ? (
        <p className="muted">Блюд не найдено</p>
      ) : (
        <div className="rest-pos-grid">
          {dishes.map((m) => (
            <button
              type="button"
              className="rest-pos-dish"
              key={m.id}
              aria-label={`Добавить: ${m.name}, ${wholeTenge(m.priceMinor, m.currency)}`}
              onClick={() => add(m.id)}
            >
              {m.photoUrl ? (
                <img src={m.photoUrl} alt="" width={160} height={120} />
              ) : (
                <span className="rest-pos-dish__ph" aria-hidden="true">
                  <Icon name="kettle" />
                </span>
              )}
              <span className="rest-pos-dish__name">{m.name}</span>
              <strong>{wholeTenge(m.priceMinor, m.currency)}</strong>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Текущий заказ справа: строки с количеством, итог по ценам меню */
function CurrentOrder({
  ctx,
  items,
  setItems,
}: {
  ctx: OrderContext;
  items: OrderItemInput[];
  setItems: (items: OrderItemInput[]) => void;
}) {
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
      <h3>
        Текущий заказ <small>({items.reduce((acc, i) => acc + i.qty, 0)})</small>
      </h3>
      {items.length === 0 && <p className="muted">Выберите блюда слева</p>}
      {items.map((item, index) => {
        const m = byId.get(item.menuItemId);
        return (
          <div className="rest-order-item rest-order-item--pos" key={item.menuItemId}>
            <span className="rest-order-qty">
              <Button tone="ghost" aria-label="Меньше" onClick={() => change(index, item.qty - 1)}>
                −
              </Button>
              <span aria-label="Количество">{item.qty}</span>
              <Button tone="ghost" aria-label="Больше" onClick={() => change(index, item.qty + 1)}>
                +
              </Button>
            </span>
            <strong>{m?.name ?? 'Блюдо'}</strong>
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
  const { ask, dialog } = useConfirm();
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
      .map((i) => ({ menuItemId: i.menuItemId!, qty: i.qty, notes: i.notes })) ??
      (draft.kind === 'create' ? (draft.items ?? []) : []),
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
  async function transition(status: OrderStatus) {
    if (!order) return;
    // отмена необратима: заказ уходит в терминальный статус, состав замораживается (ADR-182, DESIGN.md §14)
    if (
      status === 'CANCELLED' &&
      !(await ask({
        title: `Отменить заказ №${order.number}?`,
        body: 'Заказ станет отменённым, вернуть его в работу нельзя. Кухня готовить не будет.',
        confirmLabel: 'Отменить заказ',
        tone: 'danger',
      }))
    )
      return;
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
    <Overlay
      open
      onClose={close}
      title={title}
      drawer={!(editing && itemsEditable)}
      size={editing && itemsEditable ? 'lg' : 'md'}
      className={editing && itemsEditable ? 'rest-pos' : 'food-drawer'}
      trapFocus
    >
      <div className="food-detail" data-testid="order-drawer">
        {dialog}
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
            <PaymentPanel ctx={ctx} order={order} onSaved={setSaved} />
            <RatingPanel ctx={ctx} order={order} onSaved={setSaved} />
            {ctx.write && (
              <div className="food-actions">
                {order.nextStatuses
                  .filter((s) => s !== 'CANCELLED')
                  .filter((s) => s !== 'CLOSED' || order.paidMinor === order.totalMinor)
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
          <div className="rest-pos-layout">
            {itemsEditable && <DishPicker ctx={ctx} items={items} setItems={setItems} />}
            <div className="rest-pos-side">
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
                <Field label="Гостей">
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={guestCount}
                    onChange={(e) => setGuestCount(Math.max(1, Number(e.target.value) || 1))}
                  />
                </Field>
              </div>
              {itemsEditable ? (
                <CurrentOrder ctx={ctx} items={items} setItems={setItems} />
              ) : (
                <p className="muted">Состав заморожен после готовности.</p>
              )}
              <Field label="Комментарий к заказу">
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
              <div className="food-actions">
                <Button
                  className={order ? undefined : 'rest-btn-go'}
                  disabled={pending || items.length === 0}
                  onClick={submit}
                >
                  {order ? 'Сохранить' : 'Отправить на кухню'}
                </Button>
                <Button
                  tone="secondary"
                  disabled={pending}
                  onClick={() => (order ? setEditing(false) : close())}
                >
                  Отмена
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Overlay>
  );
}
