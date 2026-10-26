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
import { countLabel, msg } from '../../i18n';
import { useLocale, useT } from '../../i18n/locale-provider';
import { compareTables, tableTitle } from '../../lib/table-title';
import { formatPhone, phoneOnInput } from '../../lib/phone';
import { reservationProblem, WALK_IN_GUEST, walkInFirstName } from '../../lib/food-reservation-check';
import {
  BookingFooter,
  BookingShell,
  PickButton,
  PickGroup,
  PickHeading,
} from '../../components/booking-shell';
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
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  // своя ошибка хранится русским ключом (по нему подсвечивается поле), переводится при показе
  const [error, setError] = useState('');
  const [key] = useState(() => crypto.randomUUID());
  // гостю без брони карточка клиента не нужна: сразу «Новый», имя по умолчанию «Гость»
  const [mode, setMode] = useState<'existing' | 'new'>(!walkIn && data.customers.length ? 'existing' : 'new');
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
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setError('');
        if (!reservation) {
          const problem = reservationProblem({
            walkIn,
            mode,
            customerId: String(f.get('customerId') ?? ''),
            firstName: String(f.get('firstName') ?? ''),
            tableId: String(f.get('tableId') ?? ''),
            period: String(f.get('period') ?? ''),
          });
          if (problem) return setError(problem);
        } else if (!f.get('period')) return setError(msg('Выберите период обслуживания'));
        if (!f.get('date') || !f.get('time')) return setError(msg('Укажите дату и время'));
        if (!(party >= 1)) return setError(msg('Укажите число гостей'));
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
                            firstName: walkIn
                              ? walkInFirstName(String(f.get('firstName') ?? ''))
                              : String(f.get('firstName')).trim(),
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
      {(() => {
        const guest = !reservation && (
          <>
            <fieldset className="rest-book__mode">
              <legend>{t('Гость')}</legend>
              <div className="food-inline-actions">
                <label className="food-check">
                  <input
                    type="radio"
                    name="customerMode"
                    checked={mode === 'existing'}
                    onChange={() => setMode('existing')}
                  />
                  {t('Существующий')}
                </label>
                <label className="food-check">
                  <input
                    type="radio"
                    name="customerMode"
                    checked={mode === 'new'}
                    onChange={() => setMode('new')}
                  />
                  {t('Новый')}
                </label>
              </div>
            </fieldset>
            {mode === 'existing' ? (
              <Field label={t('Выбор клиента')}>
                <Select name="customerId" required defaultValue="">
                  <option value="">{t('Выберите клиента')}</option>
                  {data.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {[c.firstName, c.lastName].filter(Boolean).join(' ')}
                      {c.phone ? `, ${formatPhone(c.phone)}` : ''}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              // порядок владельца 23.10.2026 во всех окнах брони: сначала имя, затем телефон
              <div className="rest-book__guest">
                <Field label={t('Имя')}>
                  <Input
                    name="firstName"
                    {...(walkIn ? { placeholder: WALK_IN_GUEST } : { required: true })}
                    maxLength={100}
                  />
                </Field>
                <Field label={t('Фамилия')}>
                  <Input name="lastName" maxLength={100} />
                </Field>
                <Field label={t('Телефон')} className="rest-book__phone">
                  <Input
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    maxLength={40}
                    onInput={phoneOnInput}
                  />
                </Field>
              </div>
            )}
          </>
        );
        const when = (
          <>
            {/* общий FormGrid и обязательность словами Field (MV8.5 DS1c) */}
            <FormGrid columns={2}>
              <Field label={t('Дата')} required>
                <Input name="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label={t('Время')} required>
                <Input
                  name="time"
                  type="time"
                  value={clockValue}
                  onChange={(e) => setClockValue(e.target.value)}
                />
              </Field>
            </FormGrid>
            <FormGrid columns={2}>
              <Field label={t('Период обслуживания')}>
                <Select
                  name="period"
                  aria-invalid={!!error && /период|врем|period|time/i.test(error)} /* kk-allow: сверка с русским ключом ошибки */
                  aria-describedby={error ? 'food-form-error' : undefined}
                  required
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                >
                  <option value="">{t('Выберите период')}</option>
                  {periods.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name}, {t(weekdays[p.weekday] ?? '')}, {p.timeFrom}–{p.timeTo}
                      {p.endsNextDay ? ` ${t('(+1 день)')}` : ''}
                      {!p.active ? `, ${t('В архиве')}` : ''}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('Количество гостей')}>
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
            </FormGrid>
          </>
        );
        const extra = (
          <>
            {!reservation && !walkIn && (data.employees?.length ?? 0) > 0 && (
              <Field label={t('Принял бронь')}>
                <Select name="employeeId" defaultValue="">
                  <option value="">{t('Не указывать')}</option>
                  {data.employees!.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label={t('Заметка')}>
              <Textarea name="notes" defaultValue={reservation?.notes ?? ''} maxLength={2000} rows={2} />
            </Field>
            {error && (
              <Alert id="food-form-error" tone="warning">
                {t(error)}
              </Alert>
            )}
            {!periods.some((p) => p.active) && (
              <Alert tone="warning">{t('Настройте период обслуживания')}</Alert>
            )}
          </>
        );
        const submit = (
          <Button
            disabled={pending || data.readOnly || !data.canDesk || !periods.some((p) => p.active)}
          >
            {pending ? t('Сохраняем…') : reservation ? t('Сохранить') : walkIn ? t('Посадить') : t('Создать бронь')}
          </Button>
        );
        if (reservation)
          return (
            <>
              {when}
              {extra}
              {submit}
              <p className="muted">{t('Текущий статус: {status}', { status: t(foodStatus[reservation.status].label) })}</p>
            </>
          );
        // Окно брони вариант B (решение владельца 23.10.2026): слева гость, время, гости; справа свободные столы
        // кнопками по залам; внизу суть брони и кнопка. Занятость берётся из броней дня на экране, окончательно
        // проверяет сервер (ТЗ §8)
        const byArea = data.areas
          .filter((a) => a.active)
          .map((a) => ({ area: a, tables: suitable.filter((t) => t.areaId === a.id) }));
        const chosen = tables.find((t) => t.id === table);
        return (
          <BookingShell
            form={
              <>
                {guest}
                {when}
                {extra}
              </>
            }
            pickLabel={t('Доступные столы')}
            pick={
              <>
                <PickHeading
                  title={t('Доступные столы ({n})', { n: suitable.length })}
                  note={`${t('для {guests}', { guests: countLabel(locale, t, party, [msg('гостя'), 'гостей', msg('гостей')]) })}${clockValue ? ` ${t('в {time}', { time: clockValue })}` : ''}${known ? '' : `, ${t('занятость этого дня проверит сервер')}`}`} /* kk-allow: форма склонения */
                />
                {suitable.length === 0 && (
                  <p className="booking-pick__muted">{t('Свободных столов на это время нет')}</p>
                )}
                {byArea.map(({ area, tables: free }) => (
                  <PickGroup
                    key={area.id}
                    title={area.name}
                    testId="table-group"
                    selected={free.some((t) => t.id === table)}
                    facts={t('свободно {n}', { n: free.length })}
                    unavailable={free.length === 0 ? t('нет подходящих столов') : undefined}
                  >
                    {free.map((tb) => (
                      <PickButton
                        key={tb.id}
                        selected={table === tb.id}
                        label={t('Выбрать: {table}', { table: tableTitle(tb.name, t) })}
                        onClick={() => setTable(table === tb.id ? '' : tb.id)}
                      >
                        {`${tableTitle(tb.name, t)}, ${countLabel(locale, t, tb.capacity, [msg('место@@стол'), 'места', msg('мест@@стол')])}`}{/* kk-allow: форма склонения */}
                      </PickButton>
                    ))}
                  </PickGroup>
                ))}
                {/* полный список: и занятые столы, если администратор сажает вручную; занятость проверит сервер */}
                <Field label={t('Стол')}>
                  <Select
                    name="tableId"
                    aria-invalid={!!error && /стол|вместим/i.test(error)} /* kk-allow: сверка с русским ключом ошибки */
                    aria-describedby={error ? 'food-form-error' : undefined}
                    required={walkIn}
                    value={table}
                    onChange={(e) => setTable(e.target.value)}
                  >
                    <option value="">{walkIn ? t('Выберите стол') : t('Назначить позже')}</option>
                    {tables.map((tb) => (
                      <option key={tb.id} value={tb.id} disabled={tb.capacity < party}>
                        {areaName(tb.areaId)}, {tb.name}, {countLabel(locale, t, tb.capacity, [msg('место@@стол'), 'места', msg('мест@@стол')])}{/* kk-allow: форма склонения */}
                      </option>
                    ))}
                  </Select>
                </Field>
              </>
            }
            footer={
              <BookingFooter
                digestTestId="food-booking-digest"
                digest={[
                  `${date.split('-').reverse().join('.')} ${clockValue}`,
                  countLabel(locale, t, party, [msg('гость'), 'гостя', msg('гостей')]), // kk-allow: форма склонения
                  chosen
                    ? `${tableTitle(chosen.name, t)}, ${areaName(chosen.areaId)}`
                    : walkIn
                      ? t('выберите стол')
                      : t('стол назначим позже'),
                ].join('; ')}
              >
                {submit}
              </BookingFooter>
            }
          />
        );
      })()}
    </form>
  );
}
