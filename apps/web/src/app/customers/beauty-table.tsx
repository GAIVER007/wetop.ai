'use client';
import { useCallback, useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Input, Select, Table } from '../../components/ui';
import { Overlay } from '../../components/overlay';
import { CreateCustomer } from './create-customer';
import type { BeautyCustomerRow } from '../../lib/api';
import { displayDate } from '../../lib/display-date';
import { formatMoney } from '../../lib/money';
import { pluralRu } from '../../lib/plural';
import { CustomerMarks } from '../food/customer-marks';
import { markBeautyCustomer } from './actions';

/**
 * Клиенты салона по макету ТЗ (09.10.2026): телефон, последний визит, всего визитов, средний чек и
 * сегмент. Сегмент производный (Q-BS-3): «Новый» меньше двух завершённых визитов, «Постоянный» от двух;
 * VIP и день рождения ручные (§36, общие с рестораном). Поиск и отбор на клиенте: список уже загружен целиком.
 */
export const REGULAR_FROM = 2;

type SegmentFilter = 'all' | 'new' | 'regular' | 'vip' | 'archived';

// как у ресторана (food/customers.tsx): «15 марта», без года
const dayMonth = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const birthday = (row: BeautyCustomerRow) =>
  !row.birthDate
    ? 'Не указан'
    : row.birthdayInDays === 0
      ? `${dayMonth(row.birthDate)}, сегодня`
      : (row.birthdayInDays ?? 99) <= 7
        ? `${dayMonth(row.birthDate)}, через ${pluralRu(row.birthdayInDays!, ['день', 'дня', 'дней'])}`
        : dayMonth(row.birthDate);

function segment(row: BeautyCustomerRow): { label: string; tone: 'info' | 'ok' | 'neutral' } {
  if (row.status !== 'ACTIVE') return { label: 'В архиве', tone: 'neutral' };
  return row.visits >= REGULAR_FROM
    ? { label: 'Постоянный', tone: 'ok' }
    : { label: 'Новый', tone: 'info' };
}

export function BeautyCustomersTable({ items, canEdit = false, businessId = '' }: {
  items: BeautyCustomerRow[]; canEdit?: boolean; businessId?: string;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [saved, setSaved] = useState<{ id: string; created: boolean } | null>(null);
  const onSaved = useCallback((id: string, created: boolean) => {
    setCreating(false);
    setQuery('');
    setFilter('all');
    setSaved({ id, created });
    router.refresh();
  }, [router]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SegmentFilter>('all');
  const searchId = useId();
  useEffect(() => {
    if (saved) document.getElementById(`customer-${saved.id}`)?.focus();
  }, [saved, items]);
  const needle = query.trim().toLowerCase();
  const rows = items.filter((row) => {
    const name = [row.firstName, row.lastName].filter(Boolean).join(' ');
    if (needle && !`${name} ${row.phone ?? ''}`.toLowerCase().includes(needle)) return false;
    if (filter === 'archived') return row.status !== 'ACTIVE';
    if (row.status !== 'ACTIVE') return false;
    if (filter === 'new') return row.visits < REGULAR_FROM;
    if (filter === 'regular') return row.visits >= REGULAR_FROM;
    if (filter === 'vip') return row.isVip;
    return true;
  });
  return (
    <>
      <div className="beauty-bar">
        <p role="status">
          {rows.length === items.length
            ? pluralRu(items.length, ['клиент', 'клиента', 'клиентов'])
            : `Показано ${rows.length} из ${items.length}`}
        </p>
        <div className="beauty-customers-controls">
          {canEdit && <Button type="button" onClick={() => setCreating(true)}>Добавить клиента</Button>}
          <Input
            id={searchId}
            type="search"
            aria-label="Поиск по имени или телефону"
            placeholder="Имя или телефон"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Select
            aria-label="Сегмент"
            value={filter}
            onChange={(e) => setFilter(e.target.value as SegmentFilter)}
          >
            <option value="all">Все клиенты</option>
            <option value="new">Новые</option>
            <option value="regular">Постоянные</option>
            <option value="vip">VIP</option>
            <option value="archived">В архиве</option>
          </Select>
        </div>
      </div>
      {saved && <p role="status">{saved.created ? 'Клиент создан.' : 'Клиент уже есть. Используем существующую карточку.'}</p>}
      <Table className="beauty-customers-table">
        <thead>
          <tr>
            <th>Клиент</th>
            <th>Телефон</th>
            <th className="beauty-col-wide">Последний визит</th>
            <th>Всего визитов</th>
            <th className="beauty-col-wide">Средний чек</th>
            <th>Статус</th>
            <th>День рождения</th>
            {canEdit && <th><span className="sr-only">Действия</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={canEdit ? 8 : 7}>
                {items.length === 0
                  ? 'Клиентов пока нет.'
                  : 'Никого не нашли. Поменяйте поиск или сегмент.'}
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const s = segment(row);
            const visitDate = row.lastVisitLocalDate;
            return (
              <tr key={row.id} id={`customer-${row.id}`} tabIndex={-1}>
                <td data-label="Клиент">
                  <strong>{[row.firstName, row.lastName].filter(Boolean).join(' ')}</strong>{' '}
                  {row.isVip && <Badge tone="warn">VIP</Badge>}
                </td>
                <td data-label="Телефон" className="beauty-customer-contact">{row.phone ? <a href={`tel:${row.phone}`}>{row.phone}</a> : 'Не указан'}</td>
                <td data-label="Последний визит" className="beauty-col-wide">
                  {visitDate ? (
                    <time dateTime={visitDate}>
                      {displayDate(visitDate)}
                    </time>
                  ) : (
                    row.lastVisitAt ? 'Дата визита недоступна' : 'Визитов не было'
                  )}
                </td>
                <td data-label="Всего визитов">{row.visits}</td>
                <td data-label="Средний чек" className="beauty-col-wide">
                  {row.avgCheckMinor
                    ? formatMoney(row.avgCheckMinor, row.avgCheckCurrency ?? 'KZT')
                    : 'Нет данных'}
                </td>
                <td data-label="Статус">
                  <Badge tone={s.tone}>{s.label}</Badge>
                </td>
                <td data-label="День рождения" data-testid="customer-birthday">{birthday(row)}</td>
                {canEdit && (
                  <td>
                    <CustomerMarks
                      scopeKey=""
                      customer={{ id: row.id, name: [row.firstName, row.lastName].filter(Boolean).join(' '), isVip: row.isVip, birthDate: row.birthDate }}
                      save={markBeautyCustomer}
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </Table>
      {canEdit && <Overlay open={creating} onClose={() => setCreating(false)} title="Добавить клиента" drawer trapFocus>
        {creating && <CreateCustomer key={businessId} businessId={businessId} onSaved={onSaved} />}
      </Overlay>}
    </>
  );
}
