'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FormGrid } from '../../components/form-grid';
import { Alert, Button, Field, Input, Select, Textarea } from '../../components/ui';
import type { FoodWorkspace, RestaurantReservation } from '../../lib/food-types';
import { instantOf, localInput } from '../beauty/time';
import { mutateFoodReservation } from './actions';
import { foodStatus } from '../../lib/status/food';
import { weekdays } from '../../lib/food-data';
export function ReservationForm({
  data,
  walkIn = false,
  tableId = '',
  reservation,
  created,
  onStale,
}: {
  data: FoodWorkspace;
  walkIn?: boolean;
  tableId?: string;
  reservation?: RestaurantReservation;
  created: (r: RestaurantReservation) => void;
  onStale: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [key] = useState(() => crypto.randomUUID());
  const [mode, setMode] = useState(data.customers.length ? 'existing' : 'new');
  const [party, setParty] = useState(reservation?.partySize ?? 2);
  const local = reservation
    ? localInput(reservation.startsAt, data.timezone)
    : `${data.date}T${data.time}`;
  const periods = data.periods.filter((p) => p.active || p.id === reservation?.servicePeriodId);
  const tables = data.tables.filter(
    (t) => t.active && data.areas.some((a) => a.id === t.areaId && a.active),
  );
  return (
    <form
      className="food-form"
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setError('');
        const body = {
          servicePeriodId: String(f.get('period')),
          startsAt: instantOf(`${f.get('date')}T${f.get('time')}`, data.timezone),
          partySize: party,
          ...(String(f.get('notes') ?? '').trim()
            ? { notes: String(f.get('notes')).trim() }
            : reservation
              ? { notes: null }
              : {}),
        };
        start(async () => {
          const result = await mutateFoodReservation(
            data.scopeKey,
            reservation
              ? {
                  kind: 'edit',
                  id: reservation.id,
                  body: {
                    ...body,
                    expectedStatus: reservation.status,
                    expectedUpdatedAt: reservation.updatedAt,
                  },
                }
              : {
                  kind: 'create',
                  key,
                  body: {
                    ...body,
                    source: walkIn ? 'WALK_IN' : 'DESK',
                    ...(mode === 'existing'
                      ? { customerId: String(f.get('customerId')) }
                      : {
                          customer: {
                            firstName: String(f.get('firstName')),
                            ...(f.get('lastName') ? { lastName: String(f.get('lastName')) } : {}),
                            ...(f.get('phone') ? { phone: String(f.get('phone')) } : {}),
                          },
                        }),
                    ...(f.get('tableId') ? { tableId: String(f.get('tableId')) } : {}),
                  },
                },
          );
          if (result.error) {
            setError(result.error);
            if (result.stale) {
              router.refresh();
              onStale();
            }
          } else if (result.reservation) {
            router.refresh();
            created(result.reservation);
          }
        });
      }}
    >
      {!reservation && (
        <>
          <fieldset>
            <legend>Клиент</legend>
            <div className="food-inline-actions">
              <label className="food-check">
                <input
                  type="radio"
                  name="customerMode"
                  checked={mode === 'existing'}
                  onChange={() => setMode('existing')}
                />
                Существующий
              </label>
              <label className="food-check">
                <input
                  type="radio"
                  name="customerMode"
                  checked={mode === 'new'}
                  onChange={() => setMode('new')}
                />
                Новый
              </label>
            </div>
          </fieldset>
          {mode === 'existing' ? (
            <Field label="Выбор клиента">
              <Select name="customerId" required defaultValue="">
                <option value="">Выберите клиента</option>
                {data.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {[c.firstName, c.lastName].filter(Boolean).join(' ')}
                    {c.phone ? `, ${c.phone}` : ''}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <>
              <div className="food-form-row">
                <Field label="Имя">
                  <Input name="firstName" required maxLength={100} />
                </Field>
                <Field label="Фамилия">
                  <Input name="lastName" maxLength={100} />
                </Field>
              </div>
              <Field label="Телефон">
                <Input name="phone" type="tel" maxLength={40} />
              </Field>
            </>
          )}
        </>
      )}
      {/* общий FormGrid и обязательность словами Field (MV8.5 DS1c); остальные ряды формы: DS6 */}
      <FormGrid columns={2}>
        <Field label="Дата" required>
          <Input name="date" type="date" defaultValue={local.slice(0, 10)} />
        </Field>
        <Field label="Время" required>
          <Input name="time" type="time" defaultValue={local.slice(11, 16)} />
        </Field>
      </FormGrid>
      <Field label="Период обслуживания">
        <Select
          name="period"
          aria-invalid={!!error && /период|врем|period|time/i.test(error)}
          aria-describedby={error ? 'food-form-error' : undefined}
          required
          defaultValue={
            reservation?.servicePeriodId ??
            periods.find((p) => p.weekday === new Date(`${data.date}T12:00:00Z`).getUTCDay())?.id ??
            ''
          }
        >
          <option value="">Выберите период</option>
          {periods.map((p) => (
            <option value={p.id} key={p.id}>
              {p.name}, {weekdays[p.weekday]}, {p.timeFrom}–{p.timeTo}
              {p.endsNextDay ? ' (+1 день)' : ''}
              {!p.active ? ', В архиве' : ''}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Количество гостей">
        <Input
          name="partySize"
          type="number"
          min={1}
          max={1000}
          required
          value={party}
          onChange={(e) => setParty(Number(e.target.value))}
        />
      </Field>
      {!reservation && (
        <Field label="Стол">
          <Select
            name="tableId"
            aria-invalid={!!error && /стол|вместим/i.test(error)}
            aria-describedby={error ? 'food-form-error' : undefined}
            required={walkIn}
            defaultValue={tableId}
          >
            <option value="">{walkIn ? 'Выберите стол' : 'Не назначать сейчас'}</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id} disabled={t.capacity < party}>
                {data.areas.find((a) => a.id === t.areaId)?.name}, {t.name}, {t.capacity} мест
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Заметка">
        <Textarea name="notes" defaultValue={reservation?.notes ?? ''} maxLength={2000} rows={3} />
      </Field>
      {error && (
        <Alert id="food-form-error" tone="warning">
          {error}
        </Alert>
      )}
      {!periods.some((p) => p.active) && (
        <Alert tone="warning">Настройте период обслуживания</Alert>
      )}
      <Button
        disabled={pending || data.readOnly || !data.canDesk || !periods.some((p) => p.active)}
      >
        {pending ? 'Сохраняем…' : reservation ? 'Сохранить' : walkIn ? 'Посадить' : 'Создать бронь'}
      </Button>
      {reservation && (
        <p className="muted">Текущий статус: {foodStatus[reservation.status].label}</p>
      )}
    </form>
  );
}
