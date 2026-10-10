'use client';
import { useState } from 'react';
import { Button, EmptyState, Field, Input, StatusBadge, Table } from '../../components/ui';
import { Chip, ChipGroup } from '../../components/chip';
import { wholeTenge } from '../../lib/dashboard-format';
import type { OrderStatus, OrderView } from '../../lib/food-types';
import { localInput } from '../beauty/time';
import { OrderDrawer, type OrderContext, type OrderDraft } from './order-drawer';

/** Вкладки макета: Все, Новые, Готовятся (вместе с «Готово»), Поданы, Закрыты (с отменёнными) */
const VIEWS = [
  { id: 'all', label: 'Все', statuses: null },
  { id: 'new', label: 'Новые', statuses: ['NEW'] },
  { id: 'cooking', label: 'Готовятся', statuses: ['COOKING', 'READY'] },
  { id: 'served', label: 'Поданы', statuses: ['SERVED'] },
  { id: 'closed', label: 'Закрыты', statuses: ['CLOSED', 'CANCELLED'] },
] as const satisfies ReadonlyArray<{ id: string; label: string; statuses: OrderStatus[] | null }>;

export function OrdersBoard({ ctx, orders }: { ctx: OrderContext; orders: OrderView[] }) {
  const [view, setView] = useState<(typeof VIEWS)[number]['id']>('all');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<OrderDraft | null>(null);
  const needle = search.trim().toLocaleLowerCase('ru');
  const selected = VIEWS.find((v) => v.id === view)!;
  const filtered = orders.filter(
    (o) =>
      (!selected.statuses || (selected.statuses as OrderStatus[]).includes(o.status)) &&
      (!needle ||
        `№${o.number} ${o.table?.name ?? ''} ${o.waiter?.name ?? ''} ${o.items
          .map((i) => i.name)
          .join(' ')}`
          .toLocaleLowerCase('ru')
          .includes(needle)),
  );
  const clock = (iso: string) => localInput(iso, ctx.timezone).slice(11, 16);
  const count = (statuses: OrderStatus[] | null) =>
    statuses ? orders.filter((o) => statuses.includes(o.status)).length : orders.length;
  return (
    <div className="food-workspace" data-testid="orders-board">
      <div className="food-section-heading">
        <ChipGroup label="Статус заказа">
          {VIEWS.map((v) => (
            <Chip
              key={v.id}
              selected={view === v.id}
              count={count(v.statuses)}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </Chip>
          ))}
        </ChipGroup>
        {ctx.write && (
          <div className="food-inline-actions">
            <Button onClick={() => setDraft({ kind: 'create' })}>+ Новый заказ</Button>
          </div>
        )}
      </div>
      <div className="food-toolbar">
        <Field label="Поиск по номеру, столу или блюду">
          <Input
            type="search"
            data-page-search
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          title={orders.length ? 'Заказы не найдены' : 'На этот день заказов нет'}
          actions={
            ctx.write && !orders.length ? (
              <Button onClick={() => setDraft({ kind: 'create' })}>Создать первый заказ</Button>
            ) : null
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              {['№', 'Стол', 'Гостей', 'Состав заказа', 'Сумма', 'Статус', 'Время'].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} onClick={() => setDraft({ kind: 'view', order: o })}>
                <td>
                  <Button tone="ghost" onClick={() => setDraft({ kind: 'view', order: o })}>
                    №{o.number}
                  </Button>
                </td>
                <td>{o.table ? o.table.name : '—'}</td>
                <td>{o.guestCount}</td>
                <td>
                  <span className="rest-order-dishes">
                    {o.items.map((i) => (i.qty > 1 ? `${i.name} ×${i.qty}` : i.name)).join(', ')}
                  </span>
                </td>
                <td>{wholeTenge(o.totalMinor, o.currency)}</td>
                <td>
                  <StatusBadge kind="foodOrder" value={o.status} />
                </td>
                <td>
                  <time>{clock(o.openedAt)}</time>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {draft && <OrderDrawer ctx={ctx} draft={draft} close={() => setDraft(null)} />}
    </div>
  );
}
