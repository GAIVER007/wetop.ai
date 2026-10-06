'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import { Button, EmptyState, Field, Input, Select, Table } from '../../components/ui';
import type { BeautyAppointmentRow, BeautyDay } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { DateBar } from '../beauty/date-bar';
import { AppointmentCard } from '../beauty/appointment-card';
import { STATUS_WORD } from '../beauty/appointment-status';
import { clock } from '../beauty/time';
export function AppointmentsList({ day, readOnly }: { day: BeautyDay; readOnly: boolean }) {
  const [status, setStatus] = useState('');
  const [employee, setEmployee] = useState('');
  const [service, setService] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<BeautyAppointmentRow | null>(null);
  const router = useRouter();
  const rows = day.appointments.filter(
    (r) =>
      (!status || r.status === status) &&
      (!employee || r.employeeId === employee) &&
      (!service || r.serviceId === service) &&
      `${r.customer.name} ${r.customer.phone ?? ''}`
        .toLocaleLowerCase('ru')
        .includes(query.trim().toLocaleLowerCase('ru')),
  );
  return (
    <>
      <DateBar date={day.date} path="/appointments" />
      <div className="beauty-filters">
        <Field label="Статус">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Все статусы</option>
            {Object.entries(STATUS_WORD).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Мастер">
          <Select value={employee} onChange={(e) => setEmployee(e.target.value)}>
            <option value="">Все мастера</option>
            {day.columns.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Услуга">
          <Select value={service} onChange={(e) => setService(e.target.value)}>
            <option value="">Все услуги</option>
            {Array.from(
              new Map(
                [
                  ...day.services,
                  ...day.appointments.map((a) => ({ id: a.serviceId, name: a.serviceName })),
                ].map((s) => [s.id, s]),
              ).values(),
            ).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Поиск клиента">
          <Input
            type="search"
            data-page-search
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </Field>
      </div>
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
              <th>Услуга</th>
              <th>Мастер</th>
              <th>Статус</th>
              <th>Стоимость</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td data-label="Время">
                  {clock(r.startMinutes)}–{clock(r.endMinutes)}
                </td>
                <td data-label="Клиент">
                  <Button size="sm" tone="ghost" onClick={() => setSelected(r)}>
                    {r.customer.name}
                  </Button>
                </td>
                <td data-label="Услуга">{r.serviceName}</td>
                <td data-label="Мастер">
                  {day.columns.find((e) => e.id === r.employeeId)?.name ?? 'Мастер в архиве'}
                </td>
                <td data-label="Статус">{STATUS_WORD[r.status]}</td>
                <td data-label="Стоимость">{formatMoney(r.priceMinor, r.currency)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Overlay open={selected !== null} onClose={() => setSelected(null)} title="Запись" drawer>
        {selected && (
          <AppointmentCard
            day={day}
            row={selected}
            canEdit={!readOnly}
            onDone={() => {
              setSelected(null);
              router.refresh();
            }}
          />
        )}
      </Overlay>
    </>
  );
}
