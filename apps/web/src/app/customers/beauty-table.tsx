'use client';
import Link from 'next/link';
import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Badge, Button, EmptyState, Input, Select, Table } from '../../components/ui';
import { Overlay } from '../../components/overlay';
import { CreateCustomer } from './create-customer';
import type { BeautyCustomerRow } from '../../lib/api';
import { displayDate } from '../../lib/display-date';
import { formatMoney } from '../../lib/money';
import { pluralRu } from '../../lib/plural';
import { CustomerMarks } from '../food/customer-marks';
import { markBeautyCustomer } from './actions';
import './customers.css';
import {
  BEAUTY_REGULAR_CUSTOMER_VISITS,
  customerSegment,
  filterBeautyCustomers,
  type BeautyCustomerSegmentFilter,
} from './customer-filter';

/**
 * Клиенты салона по макету ТЗ (09.10.2026): телефон, последний визит, всего визитов, средний чек и
 * сегмент. Сегмент производный (Q-BS-3): «Новый» меньше двух завершённых визитов, «Постоянный» от двух;
 * VIP и день рождения ручные (§36, общие с рестораном). Поиск и отбор на клиенте: список уже загружен целиком.
 */
export const REGULAR_FROM = BEAUTY_REGULAR_CUSTOMER_VISITS;

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

const segment = (row: BeautyCustomerRow) => customerSegment(row);

export function BeautyCustomersTable({
  items,
  canCreate = false,
  canEdit = false,
  scopeKey = '',
  businessId = '',
  tools,
}: {
  /** импорт клиентов: кнопка в той же панели, что поиск и «Скачать Excel» (аудит 21.10.2026 п.44) */
  tools?: ReactNode;
  items: BeautyCustomerRow[];
  canCreate?: boolean;
  canEdit?: boolean;
  scopeKey?: string;
  businessId?: string;
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
  const [filter, setFilter] = useState<BeautyCustomerSegmentFilter>('all');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const searchId = useId();
  const rows = filterBeautyCustomers(items, { query, segment: filter });
  const download = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const response = await fetch('/customers/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scopeKey, query, segment: filter }),
      });
      if (!response.ok) throw new Error((await response.text()) || 'Не удалось выгрузить клиентов');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `wetop-customers-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Не удалось выгрузить клиентов');
    } finally {
      setExporting(false);
    }
  };
  useEffect(() => {
    if (saved) document.getElementById(`customer-${saved.id}`)?.focus();
  }, [saved, items]);
  return (
    <>
      <div className="beauty-customers-bar beauty-customers-controls">
        <div className="beauty-customers-bar__filters">
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
            onChange={(e) => setFilter(e.target.value as BeautyCustomerSegmentFilter)}
          >
            <option value="all">Все клиенты</option>
            <option value="new">Новые</option>
            <option value="regular">Постоянные</option>
            <option value="vip">VIP</option>
            <option value="archived">В архиве</option>
          </Select>
        </div>
        <div className="beauty-customers-bar__actions">
          {tools}
          <Button
            type="button"
            tone="secondary"
            data-scope-key={scopeKey}
            onClick={download}
            disabled={exporting || !scopeKey}
            aria-busy={exporting}
          >
            Скачать Excel
          </Button>
          {canCreate && <Button type="button" onClick={() => setCreating(true)}>Добавить клиента</Button>}
        </div>
      </div>
      {exportError && <Alert>{exportError}</Alert>}
      {saved && <p role="status">{saved.created ? 'Клиент создан.' : 'Клиент уже есть. Используем существующую карточку.'}</p>}
      {items.length === 0 ? (
        <EmptyState
          title="Клиентов пока нет"
          actions={canCreate ? <Button type="button" onClick={() => setCreating(true)}>Добавить первого клиента</Button> : undefined}
        >
          Добавьте первого клиента или импортируйте список из CSV или Excel.
        </EmptyState>
      ) : (
      <>
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
              <td colSpan={canEdit ? 8 : 7}>Никого не нашли. Поменяйте поиск или сегмент.</td>
            </tr>
          )}
          {rows.map((row) => {
            const s = segment(row);
            const visitDate = row.lastVisitLocalDate;
            return (
              <tr key={row.id} id={`customer-${row.id}`} tabIndex={-1}>
                <td data-label="Клиент">
                  <strong>
                    <Link href={`/customers/${encodeURIComponent(row.id)}`}>
                      {[row.firstName, row.lastName].filter(Boolean).join(' ')}
                    </Link>
                  </strong>{' '}
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
                      scopeKey={scopeKey}
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
      <p role="status" className="beauty-customers-total">
        {rows.length === items.length
          ? `Всего: ${pluralRu(items.length, ['клиент', 'клиента', 'клиентов'])}`
          : `Показано ${rows.length} из ${items.length}`}
      </p>
      </>
      )}
      {canCreate && <Overlay open={creating} onClose={() => setCreating(false)} title="Добавить клиента" drawer trapFocus>
        {creating && <CreateCustomer key={businessId} businessId={businessId} onSaved={onSaved} />}
      </Overlay>}
    </>
  );
}
