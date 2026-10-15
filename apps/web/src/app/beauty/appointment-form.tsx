'use client';
import { useActionState, useEffect, useState } from 'react';
import { Alert, Button, Field, Input, Select } from '../../components/ui';
import type { BeautyCustomerRow, BeautyDay } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { createAppointment } from './journal-actions';
import { instantOf } from './time';

export function AppointmentForm({
  day,
  customers,
  employeeId,
  time = '09:00',
  onDone,
}: {
  day: BeautyDay;
  customers: BeautyCustomerRow[];
  employeeId: string;
  time?: string;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(createAppointment, null);
  const [draft, setDraft] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    notes: '',
    employeeId,
  });
  const field = (key: keyof typeof draft) => ({
    value: draft[key],
    onChange: (e: { target: { value: string } }) => setDraft({ ...draft, [key]: e.target.value }),
  });
  const [date, setDate] = useState(day.date);
  const [hour, setHour] = useState(time);
  const [serviceId, setServiceId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const service = day.services.find((item) => item.id === serviceId);
  useEffect(() => {
    if (state?.message && !state.error) onDone();
  }, [state, onDone]);
  return (
    <form action={action} className="beauty-form">
      <Field label="Клиент">
        <Select
          name="customerId"
          aria-label="Клиент"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
        >
          <option value="">Новый клиент</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {[c.firstName, c.lastName].filter(Boolean).join(' ')}
              {c.status === 'ARCHIVED' ? ' (в архиве)' : ''}
            </option>
          ))}
        </Select>
      </Field>
      {!customerId && (
        <>
          <Field label="Имя клиента">
            <Input name="firstName" {...field('firstName')} required maxLength={100} />
          </Field>
          <Field label="Фамилия">
            <Input name="lastName" {...field('lastName')} maxLength={100} />
          </Field>
          <Field label="Телефон">
            <Input name="phone" {...field('phone')} type="tel" maxLength={32} />
          </Field>
        </>
      )}
      <Field label="Услуга">
        <Select
          name="serviceId"
          aria-label="Услуга"
          required
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
        >
          <option value="" disabled>
            Выберите услугу
          </option>
          {day.services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}, {s.durationMinutes} мин{s.sellable ? '' : ' (недоступна в филиале)'}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Мастер">
        <Select name="employeeId" aria-label="Мастер" required {...field('employeeId')}>
          <option value="" disabled>
            Выберите мастера
          </option>
          {day.columns.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="beauty-fields-pair">
        <Field label="Дата">
          <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Время">
          <Input type="time" required value={hour} onChange={(e) => setHour(e.target.value)} />
        </Field>
      </div>
      <input
        type="hidden"
        name="startsAt"
        value={instantOf(`${date}T${hour}`, day.location.timezone)}
      />
      <Field label="Цена">
        <Input
          readOnly
          value={service ? formatMoney(service.priceMinor, service.currency) : 'Выберите услугу'}
        />
      </Field>
      <p className="beauty-note">
        Время филиала: {day.location.timezone}. Доступность подтвердится при сохранении.
      </p>
      <Field label="Заметка">
        <Input name="notes" {...field('notes')} maxLength={2000} />
      </Field>
      {state?.error && <Alert>{state.error}</Alert>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Записываем…' : 'Записать'}
      </Button>
    </form>
  );
}
