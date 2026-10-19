'use client';
import { useState, useSyncExternalStore } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import { Alert, Button, EmptyState, Field, Input, Select, StatusBadge, Table } from '../../components/ui';
import type { BeautyCustomerRow, BeautyDay } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { DateBar } from '../../components/date-bar';
import { AppointmentCard } from '../beauty/appointment-card';
import { clock } from '../beauty/time';
import { beautyStatus } from '../../lib/status/beauty';
import { AppointmentEditor } from '../beauty/appointment-editor';
function subscribeAddress(changed: () => void) {
  window.addEventListener('popstate', changed);
  window.addEventListener('appointments-address', changed);
  return () => {
    window.removeEventListener('popstate', changed);
    window.removeEventListener('appointments-address', changed);
  };
}
export function AppointmentsList({
  day,
  customers,
  readOnly,
  canRefund = false,
  scopeKey = '',
}: {
  day: BeautyDay;
  customers: BeautyCustomerRow[];
  readOnly: boolean;
  /** возврат по выполненной записи (§54) */
  canRefund?: boolean;
  scopeKey?: string;
}) {
  const [creating, setCreating] = useState(false);
  // Non-PII context has one source: the URL (same pattern as MastersBoard).
  // Client search stays only in this scope-keyed component's memory, never in URL/history/storage.
  const [query, setQuery] = useState('');
  const router = useRouter();
  const initialParams = useSearchParams();
  const search = useSyncExternalStore(subscribeAddress, () => location.search, () => {
    const initial = initialParams.toString();
    return initial ? `?${initial}` : '';
  });
  const params = new URLSearchParams(search);
  const services = Array.from(new Map([
    ...day.services,
    ...day.appointments.map((a) => ({ id: a.serviceId, name: a.serviceName })),
  ].map((s) => [s.id, s])).values());
  let invalid = false;
  const read = (key: string, allowed: string[]) => {
    const values = params.getAll(key);
    if (values.length > 1 || (values[0] && !allowed.includes(values[0]))) {
      invalid = true;
      return '';
    }
    return values[0] ?? '';
  };
  const context = {
    date: day.date,
    employee: read('master', day.columns.map((e) => e.id)),
    service: read('service', services.map((s) => s.id)),
    status: read('status', Object.keys(beautyStatus)),
    appointment: read('appointment', day.appointments.map((a) => a.id)),
    query,
  };
  const { employee, service, status } = context;
  const selected = !invalid ? day.appointments.find((r) => r.id === context.appointment) : null;
  const address = (patch: Partial<Record<'master' | 'service' | 'status' | 'appointment', string>>, push = true) => {
    const url = new URL(location.href);
    url.searchParams.set('date', context.date);
    for (const [key, value] of Object.entries(patch)) {
      if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
    }
    // Preserve Next's own history state. No customer data is added to it.
    history[push ? 'pushState' : 'replaceState']({ ...history.state }, '', url);
    window.dispatchEvent(new Event('appointments-address'));
  };
  const changeDate = (next?: string) => {
    const url = new URL(location.href);
    if (next) url.searchParams.set('date', next); else url.searchParams.delete('date');
    url.searchParams.delete('appointment');
    router.push(`${url.pathname}${url.search}`);
  };
  const shift = (days: number) => {
    const at = new Date(`${context.date}T12:00:00Z`);
    at.setUTCDate(at.getUTCDate() + days);
    changeDate(at.toISOString().slice(0, 10));
  };
  const rows = invalid ? [] : day.appointments.filter(
    (r) =>
      (!status || r.status === status) &&
      (!employee || r.employeeId === employee) &&
      (!service || r.serviceId === service) &&
      `${r.customer.name} ${r.customer.phone ?? ''}`
        .toLocaleLowerCase('ru')
        .includes(context.query.trim().toLocaleLowerCase('ru')),
  );
  return (
    <>
      <div className="beauty-bar beauty-operational-toolbar">
        <DateBar
          date={context.date}
          onToday={() => changeDate()}
          onPrevious={() => shift(-1)}
          onNext={() => shift(1)}
          onDateChange={changeDate}
          inputProps={{ 'data-testid': 'beauty-day-date' }}
          compact
        />
        <Button
          disabled={readOnly || !day.columns.length || !day.services.length}
          onClick={() => setCreating(true)}
        >
          + Новая запись
        </Button>
      </div>
      <div className="beauty-filters beauty-list-filters">
        <Field label="Статус">
          <Select
            value={status}
            onChange={(e) => address({ status: e.target.value, appointment: '' })}
          >
            <option value="">Все статусы</option>
            {Object.entries(beautyStatus).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Мастер">
          <Select
            value={employee}
            onChange={(e) => address({ master: e.target.value, appointment: '' })}
          >
            <option value="">Все мастера</option>
            {day.columns.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Услуга">
          <Select
            value={service}
            onChange={(e) => address({ service: e.target.value, appointment: '' })}
          >
            <option value="">Все услуги</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="beauty-list-search">
          <Field label="Поиск клиента">
            <Input
              type="search"
              data-page-search
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Field>
          <p className="beauty-note">Поиск только по выбранному дню.</p>
          <p className="beauty-note">После перезагрузки поиск клиента очищается.</p>
        </div>
      </div>
      {invalid && (
        <Alert>
          Фильтр или запись недоступны в текущем филиале. Сбросьте отбор или выберите доступные
          значения.
        </Alert>
      )}
      <Button
        tone="secondary"
        className="beauty-list-reset"
        onClick={() => {
          setQuery('');
          address({ master: '', service: '', status: '', appointment: '' });
        }}
      >
        Сбросить фильтры
      </Button>
      {rows.length === 0 ? (
        <EmptyState title="Записей не найдено">
          Выберите другой день или измените фильтры.
        </EmptyState>
      ) : (
        <Table className="beauty-appointments-table">
          <thead>
            <tr>
              <th>Время</th>
              <th>Клиент</th>
              <th>Телефон</th>
              <th>Услуга</th>
              <th>Мастер</th>
              <th>Статус</th>
              <th className="beauty-amount">Стоимость</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td data-label="Время">
                  {clock(r.startMinutes)}–{clock(r.endMinutes)}
                </td>
                <td data-label="Клиент">
                  <Button size="sm" tone="ghost" onClick={() => address({ appointment: r.id })}>
                    {r.customer.name}
                  </Button>
                </td>
                <td
                  data-label="Телефон"
                  className={
                    r.customer.phone ? 'beauty-contact' : 'beauty-contact beauty-contact--empty'
                  }
                >
                  {r.customer.phone ? (
                    <a href={`tel:${r.customer.phone}`}>{r.customer.phone}</a>
                  ) : (
                    'Не указан'
                  )}
                </td>
                <td data-label="Услуга">{r.serviceName}</td>
                <td data-label="Мастер">
                  {day.columns.find((e) => e.id === r.employeeId)?.name ?? 'Мастер в архиве'}
                </td>
                <td data-label="Статус">
                  <StatusBadge kind="beauty" value={r.status} />
                </td>
                <td data-label="Стоимость" className="beauty-amount">
                  {formatMoney(r.priceMinor, r.currency)}
                </td>
                <td data-label="Действия">
                  <Button tone="secondary" onClick={() => address({ appointment: r.id })}>
                    Открыть запись
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <AppointmentEditor
        open={creating}
        onClose={() => setCreating(false)}
        scopeKey={scopeKey}
        day={day}
        customers={customers}
        employeeId={day.columns[0]?.id ?? ''}
        time={clock(day.bounds.fromMinutes)}
        onDone={() => {
          setCreating(false);
          router.refresh();
        }}
      />
      <Overlay
        open={Boolean(selected)}
        onClose={() => address({ appointment: '' }, false)}
        title="Запись"
        drawer
      >
        {selected && (
          <AppointmentCard
            scopeKey={scopeKey}
            day={day}
            row={selected}
            canEdit={!readOnly}
            canRefund={canRefund}
            onDone={() => {
              address({ appointment: '' }, false);
              router.refresh();
            }}
          />
        )}
      </Overlay>
    </>
  );
}
