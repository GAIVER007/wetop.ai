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
import { pluralRu } from '../../lib/plural';
import { compareTables, tableTitle } from '../../lib/table-title';
import { formatPhone, phoneOnInput } from '../../lib/phone';
export function ReservationForm({
  data,
  walkIn = false,
  tableId = '',
  time,
  reservation,
  created,
  onStale,
}: {
  data: FoodWorkspace;
  walkIn?: boolean;
  tableId?: string;
  /** время начала новой брони (щелчок по шкале); по умолчанию время экрана */
  time?: string;
  reservation?: RestaurantReservation;
  created: (r: RestaurantReservation) => void;
  onStale: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [key] = useState(() => crypto.randomUUID());
  const [mode, setMode] = useState(data.customers.length ? 'existing' : 'new');
  // заполненность разделов для полосы шагов макета (экран 4): только отображение, форма одна
  const [guestPicked, setGuestPicked] = useState('');
  const [guestName, setGuestName] = useState('');
  const [party, setParty] = useState(reservation?.partySize ?? 2);
  const local = reservation
    ? localInput(reservation.startsAt, data.timezone)
    : `${data.date}T${time ?? data.time}`;
  const periods = data.periods.filter((p) => p.active || p.id === reservation?.servicePeriodId);
  const tables = data.tables
    .filter((t) => t.active && data.areas.some((a) => a.id === t.areaId && a.active))
    .sort(compareTables);
  const [date, setDate] = useState(local.slice(0, 10));
  const [clockValue, setClockValue] = useState(local.slice(11, 16));
  const [period, setPeriod] = useState(
    reservation?.servicePeriodId ??
      periods.find((p) => p.weekday === new Date(`${data.date}T12:00:00Z`).getUTCDay())?.id ??
      '',
  );
  const [table, setTable] = useState(tableId);
  // подбор столов по макету (экран 4): вместимость и брони этого дня, что уже загружены экраном;
  // окончательную проверку делает сервер при создании (ТЗ §8)
  const duration = periods.find((p) => p.id === period)?.defaultDurationMinutes ?? 120;
  const from = date && clockValue ? Date.parse(instantOf(`${date}T${clockValue}`, data.timezone)) : NaN;
  const to = from + duration * 60_000;
  const known = date === data.date;
  const busy = (id: string) =>
    known &&
    data.reservations.some(
      (r) =>
        r.table?.id === id &&
        ['BOOKED', 'CONFIRMED', 'SEATED'].includes(r.status) &&
        Date.parse(r.startsAt) < to &&
        from < Date.parse(r.endsAt),
    );
  const suitable = tables
    .filter((t) => t.capacity >= party && !busy(t.id))
    .sort((a, b) => a.capacity - b.capacity || compareTables(a, b));
  const areaName = (id: string) => data.areas.find((a) => a.id === id)?.name ?? '';
  return (
    <form
      className={reservation ? 'food-form' : 'food-form rest-book'}
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
                    ...(f.get('employeeId') ? { employeeId: String(f.get('employeeId')) } : {}),
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
        <ol className="rest-steps" aria-label="Шаги брони">
          {(
            [
              ['Основное', !!(date && clockValue && period)],
              ['Гость', mode === 'existing' ? !!guestPicked : !!guestName.trim()],
              ['Стол', !!table],
              ['Подтверждение', false],
            ] as const
          ).map(([label, done], i, all) => {
            // текущий шаг: первый незаполненный обязательный раздел; «Стол» необязателен
            const current = i === [0, 1, 3].find((n) => !all[n]![1]);
            return (
              <li key={label} data-done={done || undefined} aria-current={current ? 'step' : undefined}>
                <span className="rest-steps__n" aria-hidden="true">
                  {i + 1}
                </span>
                {label}
                {done && <span className="sr-only">, заполнено</span>}
              </li>
            );
          })}
        </ol>
      )}
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
              <Select
                name="customerId"
                required
                defaultValue=""
                onChange={(e) => setGuestPicked(e.target.value)}
              >
                <option value="">Выберите клиента</option>
                {data.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {[c.firstName, c.lastName].filter(Boolean).join(' ')}
                    {c.phone ? `, ${formatPhone(c.phone)}` : ''}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <>
              <div className="food-form-row">
                <Field label="Имя">
                  <Input
                    name="firstName"
                    required
                    maxLength={100}
                    onChange={(e) => setGuestName(e.target.value)}
                  />
                </Field>
                <Field label="Фамилия">
                  <Input name="lastName" maxLength={100} />
                </Field>
              </div>
              <Field label="Телефон">
                <Input name="phone" type="tel" inputMode="tel" placeholder="+7 701 000 00 00" maxLength={40} onInput={phoneOnInput} />
              </Field>
            </>
          )}
        </>
      )}
      {/* общий FormGrid и обязательность словами Field (MV8.5 DS1c); остальные ряды формы: DS6 */}
      <FormGrid columns={2}>
        <Field label="Дата" required>
          <Input name="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Время" required>
          <Input
            name="time"
            type="time"
            value={clockValue}
            onChange={(e) => setClockValue(e.target.value)}
          />
        </Field>
      </FormGrid>
      <Field label="Период обслуживания">
        <Select
          name="period"
          aria-invalid={!!error && /период|врем|period|time/i.test(error)}
          aria-describedby={error ? 'food-form-error' : undefined}
          required
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
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
        <section className="rest-book-tables" aria-label="Доступные столы">
          <h3>Доступные столы ({suitable.length})</h3>
          <p className="muted">
            Подходящие столы для {pluralRu(party, ['гостя', 'гостей', 'гостей'])}
            {clockValue ? ` в ${clockValue}` : ''}
            {known ? '' : ', занятость этого дня проверит сервер'}
          </p>
          {suitable.length === 0 ? (
            <p className="muted">Свободных столов на это время нет</p>
          ) : (
            <ul className="rest-book-grid">
              {suitable.map((t) => (
                <li key={t.id} data-selected={table === t.id || undefined}>
                  <strong>{tableTitle(t.name)}</strong>
                  <small>{pluralRu(t.capacity, ['место', 'места', 'мест'])}</small>
                  <small>{areaName(t.areaId)}</small>
                  <Button
                    type="button"
                    size="sm"
                    tone={table === t.id ? 'primary' : 'secondary'}
                    aria-pressed={table === t.id}
                    aria-label={`Выбрать: ${tableTitle(t.name)}`}
                    onClick={() => setTable(table === t.id ? '' : t.id)}
                  >
                    {table === t.id ? 'Выбран' : 'Выбрать'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {!reservation && (
        <Field label="Стол">
          <Select
            name="tableId"
            aria-invalid={!!error && /стол|вместим/i.test(error)}
            aria-describedby={error ? 'food-form-error' : undefined}
            required={walkIn}
            value={table}
            onChange={(e) => setTable(e.target.value)}
          >
            <option value="">{walkIn ? 'Выберите стол' : 'Не назначать сейчас'}</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id} disabled={t.capacity < party}>
                {data.areas.find((a) => a.id === t.areaId)?.name}, {t.name},{' '}
                {pluralRu(t.capacity, ['место', 'места', 'мест'])}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {!reservation && !walkIn && (data.employees?.length ?? 0) > 0 && (
        <Field label="Принял бронь">
          <Select name="employeeId" defaultValue="">
            <option value="">Не указывать</option>
            {data.employees!.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
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
