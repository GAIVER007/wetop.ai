'use client';
import { useId, useState } from 'react';
import { Badge, Input, Select, Table } from '../../components/ui';
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

export function BeautyCustomersTable({ items, canEdit = false }: { items: BeautyCustomerRow[]; canEdit?: boolean }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SegmentFilter>('all');
  const searchId = useId();
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
                  ? 'Клиентов пока нет. Новый клиент добавляется при создании записи.'
                  : 'Никого не нашли. Поменяйте поиск или сегмент.'}
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const s = segment(row);
            const visitDate = row.lastVisitLocalDate;
            return (
              <tr key={row.id}>
                <td data-label="Клиент">
                  {[row.firstName, row.lastName].filter(Boolean).join(' ')}{' '}
                  {row.isVip && <Badge tone="warn">VIP</Badge>}
                </td>
                <td data-label="Телефон">{row.phone ?? 'Не указан'}</td>
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
    </>
  );
}
