'use client';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Badge, Button, EmptyState } from '../../components/ui';
import { wholeTenge } from '../../lib/dashboard-format';
import type {
  MenuCategory,
  MenuItemView,
  OrderItemInput,
  OrderItemStatus,
  OrderView,
  WaiterTable,
} from '../../lib/food-types';
import { countLabel, msg } from '../../i18n';
import { useLocale, useT } from '../../i18n/locale-provider';
import { localInput } from '../beauty/time';
import { CurrentOrder, DishPicker } from '../food/dish-picker';
import { mutateOrder } from '../food/restaurant-actions';
import { tableTitle } from '../../lib/table-title';
import { orderLinesToCart } from '../../lib/food-modifiers';
import { LineModifiers } from '../food/modifier-parts';

/** Слова статуса позиции для официанта (§33.6): «Готово к выдаче» значит пора нести гостю */
export const ITEM_STATUS_LABEL: Record<OrderItemStatus, string> = {
  NEW: msg('Отправлено'),
  COOKING: msg('Готовится'),
  READY: msg('Готово к выдаче'),
  SERVED: msg('Подано'),
};
const STATION_LABEL = { KITCHEN: msg('Кухня'), BAR: msg('Бар') } as const;
const SEAT_FORMS: [string, string, string] = [msg('место@@стол'), 'места', msg('мест@@стол')]; // kk-allow: форма склонения
const GUEST_FORMS: [string, string, string] = [msg('гость'), 'гостя', msg('гостей')]; // kk-allow: форма склонения
/** Автообновление экрана: статусы позиций меняют кухня и бар */
const REFRESH_MS = 15_000;

/**
 * Экран официанта с телефона (§33.6): вкладки «Столы» и «Мои заказы». Стол, затем меню вкладками, поиск, ± количество,
 * корзина снизу, «Отправить». На столе со своим открытым заказом «Отправить» дозаказывает в него.
 */
export function WaiterBoard({
  scopeKey,
  timezone,
  write,
  me,
  tables,
  categories,
  menuItems,
  orders,
}: {
  scopeKey: string;
  timezone: string;
  write: boolean;
  me: { id: string; name: string } | null;
  tables: WaiterTable[];
  categories: MenuCategory[];
  menuItems: MenuItemView[];
  orders: OrderView[];
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [view, setView] = useState<'tables' | 'orders'>('tables');
  const [tableId, setTableId] = useState<string | null>(null);
  const [cart, setCart] = useState<OrderItemInput[]>([]);
  const [guests, setGuests] = useState(2);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, start] = useTransition();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [router]);
  const table = tables.find((tb) => tb.id === tableId) ?? null;
  const tableOrder = table ? orders.find((o) => o.tableId === table.id) : undefined;
  const ready = orders.reduce((n, o) => n + o.items.filter((i) => i.status === 'READY').length, 0);
  const areas = useMemo(() => {
    const out: Array<{ id: string; name: string; tables: WaiterTable[] }> = [];
    for (const tb of tables) {
      const area = out.find((a) => a.id === tb.areaId);
      if (area) area.tables.push(tb);
      else out.push({ id: tb.areaId, name: tb.areaName, tables: [tb] });
    }
    return out;
  }, [tables]);
  const menu = { categories, menuItems };
  const clock = (iso: string) => localInput(iso, timezone).slice(11, 16);

  function send() {
    if (!table || !cart.length) return;
    setError('');
    setNotice('');
    start(async () => {
      const add = tableOrder && tableOrder.items.every((i) => i.menuItemId);
      const merged = add
        ? [...orderLinesToCart(tableOrder!.items), ...cart]
        : cart;
      const result = add
        ? await mutateOrder(scopeKey, {
            kind: 'edit',
            id: tableOrder!.id,
            body: { expectedStatus: tableOrder!.status, expectedUpdatedAt: tableOrder!.updatedAt, items: merged },
          })
        : await mutateOrder(scopeKey, {
            kind: 'create',
            body: { tableId: table.id, waiterId: me?.id ?? null, guestCount: guests, notes: null, items: cart },
          });
      if (result.error) {
        setError(result.error);
        if (result.stale) router.refresh();
        return;
      }
      setCart([]);
      setTableId(null);
      setNotice(t('{table}: заказ отправлен на кухню и в бар', { table: tableTitle(table.name, t) }));
      setView('orders');
      router.refresh();
    });
  }

  function served(order: OrderView, itemId: string) {
    setError('');
    start(async () => {
      const result = await mutateOrder(scopeKey, {
        kind: 'item-status',
        id: order.id,
        itemId,
        body: { status: 'SERVED', expectedUpdatedAt: order.updatedAt },
      });
      if (result.error) setError(result.error);
      router.refresh();
    });
  }

  return (
    <div className="waiter-board" data-testid="waiter-board">
      <nav className="tabs waiter-tabs" aria-label={t('Экран официанта')}>
        <button className="tabs__item"
          type="button"
          aria-current={view === 'tables' ? 'page' : undefined}
          onClick={() => setView('tables')}
        >
          {t('Столы')}
        </button>
        <button className="tabs__item"
          type="button"
          aria-current={view === 'orders' ? 'page' : undefined}
          onClick={() => setView('orders')}
        >
          {t('Мои заказы')} ({orders.length}){ready > 0 && <span className="waiter-tabs__ready">{t(', готово {n}', { n: ready })}</span>}
        </button>
      </nav>
      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}
      {view === 'tables' && !table && (
        <section aria-label={t('Столы зала')} className="waiter-floor">
          {tables.length === 0 && <EmptyState title={t('В зале пока нет столов')} details={t('Столы добавляет руководитель.')} />}
          {areas.map((a) => (
            <section key={a.id} aria-label={a.name} className="waiter-area">
              <h2>{a.name}</h2>
              <ul className="waiter-tables">
                {a.tables.map((tb) => (
                  <li key={tb.id}>
                    <button
                      type="button"
                      className="waiter-table"
                      data-busy={tb.busy || undefined}
                      data-mine={tb.mine || undefined}
                      data-testid="waiter-table"
                      disabled={!write}
                      aria-label={`${tableTitle(tb.name, t)}, ${tb.mine ? t('мой заказ') : tb.busy ? t('занят') : t('свободен')}`}
                      onClick={() => {
                        setTableId(tb.id);
                        setNotice('');
                        setGuests(Math.min(2, tb.capacity));
                      }}
                    >
                      <strong>{tableTitle(tb.name, t)}</strong>
                      <small>{tb.mine ? t('Мой заказ') : tb.busy ? t('Занят') : t('Свободен')}</small>
                      <small>{countLabel(locale, t, tb.capacity, SEAT_FORMS)}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </section>
      )}
      {view === 'tables' && table && (
        <section aria-label={t('Заказ: {table}', { table: tableTitle(table.name, t) })} className="waiter-take">
          <div className="waiter-take__head">
            <Button tone="secondary" onClick={() => setTableId(null)}>
              {t('← Столы')}
            </Button>
            <h2 className="waiter-take__title">{tableTitle(table.name, t)}</h2>
            {tableOrder ? (
              <Badge tone="info">{t('Дозаказ к №{n}', { n: tableOrder.number })}</Badge>
            ) : (
              <span className="waiter-guests" role="group" aria-label={t('Гостей')}>
                <Button tone="ghost" aria-label={t('Меньше гостей')} onClick={() => setGuests(Math.max(1, guests - 1))}>
                  −
                </Button>
                <span>{countLabel(locale, t, guests, GUEST_FORMS)}</span>
                <Button tone="ghost" aria-label={t('Больше гостей')} onClick={() => setGuests(Math.min(50, guests + 1))}>
                  +
                </Button>
              </span>
            )}
          </div>
          <DishPicker ctx={menu} items={cart} setItems={setCart} />
          <div className="waiter-cart" data-testid="waiter-cart">
            <CurrentOrder ctx={menu} items={cart} setItems={setCart} />
            <Button
              className="waiter-send"
              data-testid="waiter-send"
              disabled={pending || !cart.length || !write}
              onClick={send}
            >
              {pending ? t('Отправляем…') : tableOrder ? t('Дозаказать') : t('Отправить')}
            </Button>
          </div>
        </section>
      )}
      {view === 'orders' && (
        <section aria-label={t('Мои открытые заказы')} className="waiter-orders" data-testid="waiter-orders">
          {orders.length === 0 && <EmptyState title={t('Открытых заказов нет')} />}
          {orders.map((o) => (
            <article key={o.id} className="waiter-order" data-testid="waiter-order">
              <header>
                <strong>
                  №{o.number}, {o.table ? tableTitle(o.table.name, t) : t('Без стола')}
                </strong>
                <time dateTime={o.openedAt}>{clock(o.openedAt)}</time>
              </header>
              <ul>
                {o.items.map((i) => (
                  <li key={i.id} data-status={i.status ?? 'NEW'} data-testid="waiter-item">
                    <span className="waiter-order__name">
                      {i.name} ×{i.qty}
                      <LineModifiers modifiers={i.modifiers} notes={i.notes} />
                      <small>{t(STATION_LABEL[i.station ?? 'KITCHEN'])}</small>
                    </span>
                    <span className="waiter-order__status">{t(ITEM_STATUS_LABEL[i.status ?? 'NEW'])}</span>
                    {i.status === 'READY' && write && (
                      <Button
                        size="sm"
                        disabled={pending}
                        aria-label={t('Подано: {name}', { name: i.name })}
                        onClick={() => served(o, i.id)}
                      >
                        {t('Подано')}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              <footer>
                <span>{t('Итого')}</span>
                <strong>{wholeTenge(o.totalMinor, o.currency)}</strong>
              </footer>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
