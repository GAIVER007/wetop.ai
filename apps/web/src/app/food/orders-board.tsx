'use client';
import { useState } from 'react';
import { Button, EmptyState, Field, Input, StatusBadge, Table } from '../../components/ui';
import { Chip, ChipGroup } from '../../components/chip';
import { wholeTenge } from '../../lib/dashboard-format';
import type { OrderStatus, OrderView } from '../../lib/food-types';
import { localInput } from '../beauty/time';
import { OrderDrawer, type OrderContext, type OrderDraft } from './order-drawer';
import { useRouter, useSearchParams } from 'next/navigation';
import { EmployeeFilter } from '../../components/employee-filter';
import { DateBar } from '../../components/date-bar';
import { QuickReport } from '../../components/quick-report';
import { orderQuickReport } from '../../components/quick-report-data';
import { shiftDate } from '../../lib/food-data';

/** Вкладки макета: Все, Новые, Готовятся (вместе с «Готово»), Поданы, Закрыты (с отменёнными) */
const VIEWS = [
  { id: 'all', label: 'Все', statuses: null },
  { id: 'new', label: 'Новые', statuses: ['NEW'] },
  { id: 'cooking', label: 'Готовятся', statuses: ['COOKING', 'READY'] },
  { id: 'served', label: 'Поданы', statuses: ['SERVED'] },
  { id: 'closed', label: 'Закрыты', statuses: ['CLOSED', 'CANCELLED'] },
] as const satisfies ReadonlyArray<{ id: string; label: string; statuses: OrderStatus[] | null }>;

export function OrdersBoard({
  ctx,
  orders,
  date,
}: {
  ctx: OrderContext;
  orders: OrderView[];
  date: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const employee = params.get('employee') ?? '';
  const navigate = (key: string, value: string) => {
    const query = new URLSearchParams(params.toString());
    if (value) query.set(key, value);
    else query.delete(key);
    router.push(`/orders?${query}`, { scroll: false });
  };
  const options = [
    ...new Map([
      ...ctx.employees.map((e) => [e.id, { id: e.id, name: e.name }] as const),
      ...orders.filter((o) => o.waiter).map((o) => [o.waiter!.id, o.waiter!] as const),
    ]).values(),
  ];
  const scoped = orders.filter((o) => !employee || o.waiter?.id === employee);
  const [view, setView] = useState<(typeof VIEWS)[number]['id']>('all');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<OrderDraft | null>(null);
  const needle = search.trim().toLocaleLowerCase('ru');
  const selected = VIEWS.find((v) => v.id === view)!;
  const filtered = scoped.filter(
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
    statuses ? scoped.filter((o) => statuses.includes(o.status)).length : scoped.length;
  return (
    <div className="food-workspace" data-testid="orders-board">
      <div className="calendar-toolbar">
        <EmployeeFilter
          options={options}
          value={employee}
          onChange={(id) => navigate('employee', id)}
        />
        <DateBar
          calendar
          compact
          date={date}
          onDateChange={(next) => navigate('date', next)}
          onPrevious={() => navigate('date', shiftDate(date, -1))}
          onNext={() => navigate('date', shiftDate(date, 1))}
          onToday={() => navigate('date', '')}
        />
        <QuickReport
          key={`${date}:${employee}`}
          date={date}
          scope={['Открыты за выбранный день', employee ? (options.find((e) => e.id === employee)?.name ?? 'Сотрудник недоступен') : 'Все сотрудники', selected.label, ...(search ? ['С учётом поиска'] : [])]}
          build={() =>
            orderQuickReport(
              filtered.filter((o) => localInput(o.openedAt, ctx.timezone).slice(0, 10) === date),
            )
          }
        />
      </div>
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
              <tr key={o.id}>
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
