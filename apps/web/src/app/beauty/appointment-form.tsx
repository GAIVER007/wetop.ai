'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { Alert, Button, Field, Input, Select } from '../../components/ui';
import { matchesCustomer } from '../../lib/customer-match';
import type { BeautyAppointmentRow, BeautyCustomerRow, BeautyDay } from '../../lib/api';
import { formatMoney, inputToMinor, minorToInput } from '../../lib/money';
import { createAppointment, moveAppointment } from './journal-actions';
import { instantOf, localInput } from './time';
import { zoneLabel } from '../../lib/human-period';
import { formatPhone, formatPhoneInput } from '../../lib/phone';
import { BookingShell, PickButton, PickGroup } from '../../components/booking-shell';
import { freeSlots } from './free-slots';
import { useT } from '../../i18n/locale-provider';

// A5 (паритет с zapis.kz): кого выбирали в прошлый раз на этой вкладке; удобство, не данные
let lastPickedCustomerId: string | null = null;

export function AppointmentForm({
  day,
  customers,
  employeeId,
  time = '09:00',
  onDone,
  scopeKey = '',
  onStateChange,
  canAdjustPrice = false,
  editing,
  repeatFrom,
}: {
  day: BeautyDay;
  customers: BeautyCustomerRow[];
  employeeId: string;
  time?: string;
  onDone: () => void;
  scopeKey?: string;
  canAdjustPrice?: boolean;
  editing?: BeautyAppointmentRow;
  repeatFrom?: BeautyAppointmentRow;
  onStateChange?: (state: { dirty: boolean; pending: boolean }) => void;
}) {
  const t = useT();
  const source = editing ?? repeatFrom;
  const durationText = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return hours === 0
      ? t('{n} мин', { n: rest })
      : rest === 0
        ? t('{h} ч', { h: hours })
        : t('{h} ч {m} мин', { h: hours, m: rest });
  };
  const inFlight = useRef(false);
  const [state, action, pending] = useActionState(
    async (
      _prev: Awaited<ReturnType<typeof createAppointment>> | null,
      form: FormData,
    ): Promise<Awaited<ReturnType<typeof createAppointment>>> => {
      try {
        return editing ? await moveAppointment(null, form) : await createAppointment(null, form);
      } catch {
        return {
          outcome: 'unknown' as const,
          error: t('Результат не подтверждён. Проверьте список записей перед повторным созданием.'),
        };
      } finally {
        inFlight.current = false;
      }
    },
    null,
  );
  const [draft, setDraft] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    notes: source?.notes ?? '',
    employeeId,
  });
  const field = (key: keyof typeof draft) => ({
    value: draft[key],
    onChange: (e: { target: { value: string } }) => setDraft({ ...draft, [key]: e.target.value }),
  });
  const initialLocal = editing
    ? localInput(editing.startsAt, day.location.timezone)
    : `${day.date}T${time}`;
  const [date, setDate] = useState(initialLocal.slice(0, 10));
  const [hour, setHour] = useState(initialLocal.slice(11, 16));
  type Line = {
    key: number;
    serviceId: string;
    employeeId: string;
    duration: string;
    price: string;
    discount: string;
    discountMode: 'amount' | 'percent';
    surcharge: string;
  };
  const nextKey = useRef(1);
  const blankLine = (key: number): Line => ({
    key,
    serviceId: '',
    employeeId,
    duration: '',
    price: '',
    discount: '',
    discountMode: 'amount',
    surcharge: '',
  });
  const [lines, setLines] = useState<Line[]>(() =>
    source?.items?.length
      ? source.items.map((item, index) => ({
          key: index,
          serviceId: item.serviceId,
          employeeId: item.employeeId,
          duration: editing ? String(item.durationMinutes) : '',
          price: editing ? minorToInput(item.basePriceMinor) : '',
          discount: !editing
            ? ''
            : item.discountPercent === null
              ? minorToInput(item.discountMinor)
              : String(item.discountPercent),
          discountMode: !editing || item.discountPercent === null ? 'amount' : 'percent',
          surcharge: editing ? minorToInput(item.surchargeMinor) : '',
        }))
      : source
        ? [
            {
              key: 0,
              serviceId: source.serviceId,
              employeeId: source.employeeId,
              duration: editing ? String(source.endMinutes - source.startMinutes) : '',
              price: editing ? minorToInput(source.priceMinor) : '',
              discount: '',
              discountMode: 'amount',
              surcharge: '',
            },
          ]
        : [blankLine(0)],
  );
  const initialLines = useRef(JSON.stringify(lines));
  nextKey.current = Math.max(nextKey.current, ...lines.map((line) => line.key + 1));
  const [customerSearch, setCustomerSearch] = useState('');
  const updateLine = (key: number, change: Partial<Line>) =>
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...change } : line)),
    );
  const effectiveFor = (line: Line) =>
    appointmentLineDefaults(day, line.serviceId, line.employeeId);
  const selectLine = (line: Line, change: Partial<Line>) => {
    const next = { ...line, ...change, price: '', duration: '' };
    updateLine(line.key, next);
  };
  const payload = lines.map((line) => ({
    employeeId: line.employeeId,
    serviceId: line.serviceId,
    ...(canAdjustPrice && line.duration ? { durationMinutes: Number(line.duration) } : {}),
    ...(canAdjustPrice && line.price ? { basePriceMinor: inputToMinor(line.price) } : {}),
    ...(canAdjustPrice && line.discount
      ? line.discountMode === 'percent'
        ? { discountPercent: Number(line.discount) }
        : { discountMinor: inputToMinor(line.discount) }
      : {}),
    ...(canAdjustPrice && line.surcharge ? { surchargeMinor: inputToMinor(line.surcharge) } : {}),
  }));
  const lineTotal = (line: Line) => {
    const price = line.price ? inputToMinor(line.price) : effectiveFor(line).price;
    const percentage = Number(line.discount || '0');
    if (
      line.discountMode === 'percent' &&
      (!Number.isInteger(percentage) || percentage < 0 || percentage > 100)
    )
      return null;
    const discount =
      line.discountMode === 'percent' && price !== null
        ? ((BigInt(price) * BigInt(percentage)) / 100n).toString()
        : inputToMinor(line.discount || '0');
    const surcharge = inputToMinor(line.surcharge || '0');
    if (
      price === null ||
      discount === null ||
      surcharge === null ||
      BigInt(discount) > BigInt(price)
    )
      return null;
    const total = BigInt(price) - BigInt(discount) + BigInt(surcharge);
    return total < 0n ? null : total;
  };
  const totals = lines.map(lineTotal);
  // An unselected service is reported by the native `required` check on submit; only lines with a
  // chosen service can make the money or the duration invalid.
  const validMoney = totals.every((value, index) => value !== null || !lines[index]!.serviceId);
  const validDuration = lines.every((line) => {
    if (!line.serviceId) return true;
    const minutes = Number(line.duration || effectiveFor(line).duration);
    return Number.isInteger(minutes) && minutes > 0 && minutes <= 1440;
  });
  const total = totals.reduce<bigint>((sum, value) => sum + (value ?? 0n), 0n);
  // A3 (паритет с zapis.kz): строки идут подряд, поэтому длительность визита это сумма строк
  const totalMinutes = lines.reduce(
    (sum, line) => sum + Number(line.duration || effectiveFor(line).duration || 0),
    0,
  );
  const search = customerSearch.trim().toLocaleLowerCase();
  const matchingCustomers = customers.filter(
    (customer) =>
      customer.status !== 'ARCHIVED' &&
      (!search ||
        matchesCustomer(customerSearch, {
          name: `${customer.firstName} ${customer.lastName ?? ''}`,
          phone: customer.phone,
        })),
  );

  const [customerId, setCustomerId] = useState(repeatFrom?.customer.id ?? '');
  const pickedRow = customers.find((c) => c.id === customerId);
  const pickedCustomer = !customerId
    ? null
    : pickedRow
      ? {
          name: [pickedRow.firstName, pickedRow.lastName].filter(Boolean).join(' '),
          phone: pickedRow.phone ? formatPhone(pickedRow.phone) : '',
        }
      : repeatFrom && repeatFrom.customer.id === customerId
        ? { name: repeatFrom.customer.name, phone: repeatFrom.customer.phone ?? '' }
        : { name: customerId, phone: '' };
  const initial = useRef({
    employeeId,
    date: initialLocal.slice(0, 10),
    time: initialLocal.slice(11, 16),
    scopeKey,
  });
  const dirty = Boolean(
    draft.firstName ||
    draft.lastName ||
    draft.phone ||
    draft.notes !== (source?.notes ?? '') ||
    draft.employeeId !== initial.current.employeeId ||
    date !== initial.current.date ||
    hour !== initial.current.time ||
    JSON.stringify(lines) !== initialLines.current ||
    customerId !== (repeatFrom?.customer.id ?? '') ||
    customerSearch,
  );
  useEffect(() => {
    onStateChange?.({ dirty, pending });
  }, [dirty, pending, onStateChange]);
  useEffect(() => {
    if (state?.message && !state.error) onDone();
  }, [state, onDone]);
  // Справа свободное время мастера первой услуги (решение 23.10.2026, окно брони вариант B): по записям дня
  // журнала; длительность всего визита, если все услуги у него, иначе первой услуги
  const slotMaster = day.columns.find((c) => c.id === lines[0]?.employeeId);
  const firstDuration = Number(
    lines[0]?.duration || (lines[0] ? effectiveFor(lines[0]).duration : 0) || 0,
  );
  const slotDuration = lines.every((line) => line.employeeId === lines[0]?.employeeId)
    ? totalMinutes
    : firstDuration;
  const nowLocal = localInput(new Date().toISOString(), day.location.timezone);
  const slots =
    slotMaster && date === day.date && slotDuration > 0
      ? freeSlots(
          slotMaster,
          day.appointments.filter((a) => a.id !== editing?.id),
          slotDuration,
          nowLocal.slice(0, 10) === day.date
            ? Number(nowLocal.slice(11, 13)) * 60 + Number(nowLocal.slice(14, 16))
            : undefined,
        )
      : [];
  const chosenServices = lines
    .map((line) => day.services.find((service) => service.id === line.serviceId)?.name)
    .filter(Boolean);
  const digest = [
    chosenServices.join(', ') || t('Услуга не выбрана'),
    slotMaster?.name,
    `${date.split('-').reverse().join('.')} ${hour}`,
  ]
    .filter(Boolean)
    .join('; ');
  return (
    <form
      action={action}
      className="beauty-form appointment-form"
      onSubmitCapture={(event) => {
        if (inFlight.current || state?.outcome === 'unknown') {
          event.preventDefault();
          return;
        }
        if (!validMoney || !validDuration) {
          event.preventDefault();
          return;
        }
        inFlight.current = true;
      }}
    >
      <input type="hidden" name="scopeKey" value={initial.current.scopeKey} />
      {editing && <input type="hidden" name="id" value={editing.id} />}
      <input type="hidden" name="items" value={JSON.stringify(payload)} />
      <BookingShell
        form={
          <>
      {!editing && (
        <fieldset className="appointment-customer-fields">
          <legend>{t('Клиент')}</legend>
          <Field label={t('Телефон или имя')}>
            <Input
              type="search"
              value={customerSearch}
              onChange={(event) => setCustomerSearch(event.target.value)}
              autoComplete="off"
            />
          </Field>
          {search && matchingCustomers.length > 0 && (
            <div className="appointment-customer-suggest" role="listbox" aria-label={t('Найденные клиенты')}>
              {matchingCustomers.slice(0, 5).map((c) => (
                <Button
                  key={c.id}
                  type="button"
                  size="sm"
                  tone="ghost"
                  onClick={() => {
                    setCustomerId(c.id);
                    lastPickedCustomerId = c.id;
                    setCustomerSearch('');
                  }}
                >
                  {`${[c.firstName, c.lastName].filter(Boolean).join(' ')}${c.phone ? `, ${formatPhone(c.phone)}` : ''}`}
                </Button>
              ))}
            </div>
          )}
          <div className="appointment-customer-quick">
            {/* A5 (паритет с zapis.kz): «Гость» - визит без контактов, «Последний клиент» - выбранный в прошлый раз */}
            <Button
              type="button"
              size="sm"
              tone="secondary"
              onClick={() => {
                setCustomerId('');
                setDraft({ ...draft, firstName: 'Гость', lastName: '', phone: '' }); // kk-allow: имя клиента сохраняется в базу как данные, как и раньше
              }}
            >
              {t('Гость')}
            </Button>
            <Button
              type="button"
              size="sm"
              tone="secondary"
              disabled={!lastPickedCustomerId || !customers.some((c) => c.id === lastPickedCustomerId)}
              onClick={() => lastPickedCustomerId && setCustomerId(lastPickedCustomerId)}
            >
              {t('Последний клиент')}
            </Button>
            <Button
              type="button"
              size="sm"
              tone="ghost"
              aria-pressed={!customerId}
              onClick={() => setCustomerId('')}
            >
              {t('+ Новый клиент')}
            </Button>
          </div>
          <input type="hidden" name="customerId" value={customerId} />
          {pickedCustomer && (
            <span className="appointment-customer-chip" data-testid="appointment-customer-chip">
              {`${pickedCustomer.name}${pickedCustomer.phone ? `, ${pickedCustomer.phone}` : ''}`}
              <button
                type="button"
                className="appointment-customer-chip-remove"
                aria-label={`${t('Убрать клиента')}: ${pickedCustomer.name}`}
                onClick={() => setCustomerId('')}
              >
                ×
              </button>
            </span>
          )}
          {!customerId && (
            <div className="appointment-customer-new">
              <Field label={t('Имя клиента')}>
                <Input name="firstName" {...field('firstName')} required maxLength={100} />
              </Field>
              <Field label={t('Фамилия')}>
                <Input name="lastName" {...field('lastName')} maxLength={100} />
              </Field>
              <Field label={t('Телефон')}>
                <Input
                  name="phone"
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: formatPhoneInput(e.target.value) })}
                  type="tel"
                  inputMode="tel"
                  maxLength={32}
                />
              </Field>
            </div>
          )}
        </fieldset>
      )}
      {state?.error && <Alert>{state.error}</Alert>}
          </>
        }
        pick={
          <>
      <fieldset className="appointment-pick">
        <legend>{t('Услуга и время')}</legend>
        {lines.map((line, index) => {
          const effective = effectiveFor(line);
          const duration = Number(line.duration || effective.duration || 0);
          const durationHours = Math.floor(duration / 60);
          const durationMinutes = duration % 60;
          const minuteOptions = [
            ...new Set([...Array.from({ length: 12 }, (_, minute) => minute * 5), durationMinutes]),
          ].sort((a, b) => a - b);
          return (
            <fieldset key={line.key} className="appointment-service-line">
              <legend className={lines.length === 1 ? 'sr-only' : undefined}>{t('Услуга {n}', { n: index + 1 })}</legend>
              <Field label={t('Услуга')}>
                <Select
                  aria-label={index === 0 ? t('Услуга') : t('Услуга {n}', { n: index + 1 })}
                  required
                  value={line.serviceId}
                  onChange={(event) => selectLine(line, { serviceId: event.target.value })}
                >
                  <option value="" disabled>
                    {t('Выберите услугу')}
                  </option>
                  {day.services
                    .filter((service) => service.sellable)
                    .map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}, {t('{n} мин', { n: service.durationMinutes })}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label={t('Специалист')}>
                <Select
                  aria-label={index === 0 ? t('Специалист') : t('Специалист услуги {n}', { n: index + 1 })}
                  required
                  value={line.employeeId}
                  onChange={(event) => selectLine(line, { employeeId: event.target.value })}
                >
                  <option value="" disabled>
                    {t('Выберите специалиста')}
                  </option>
                  {day.columns
                    .filter(
                      (master) => !line.serviceId || master.serviceIds.includes(line.serviceId),
                    )
                    .map((master) => (
                      <option key={master.id} value={master.id}>
                        {master.name}
                      </option>
                    ))}
                </Select>
              </Field>
              <div className="beauty-fields-pair appointment-duration-price">
                <div>
                  <span className="field">{t('Длительность')}</span>
                  <div className="appointment-duration-controls">
                    <Field label={<span className="sr-only">{t('Часы')}</span>}>
                      <Select
                        aria-label={t('Часы услуги {n}', { n: index + 1 })}
                        disabled={!canAdjustPrice}
                        value={durationHours}
                        onChange={(event) => {
                          const hours = Number(event.target.value);
                          updateLine(line.key, {
                            duration: String(hours * 60 + (hours === 24 ? 0 : durationMinutes)),
                          });
                        }}
                      >
                        {Array.from({ length: 25 }, (_, hours) => (
                          <option key={hours} value={hours}>
                            {t('{h} ч', { h: hours })}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={<span className="sr-only">{t('Минуты')}</span>}>
                      <Select
                        aria-label={t('Минуты услуги {n}', { n: index + 1 })}
                        disabled={!canAdjustPrice}
                        value={durationMinutes}
                        onChange={(event) =>
                          updateLine(line.key, {
                            duration: String(durationHours * 60 + Number(event.target.value)),
                          })
                        }
                      >
                        {minuteOptions.map((minutes) => (
                          <option
                            key={minutes}
                            value={minutes}
                            disabled={durationHours === 24 && minutes !== 0}
                          >
                            {t('{n} мин', { n: String(minutes).padStart(2, '0') })}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                </div>
                <Field label={t('Цена, {currency}', { currency: day.location.currency })}>
                  <Input
                    inputMode="decimal"
                    required
                    readOnly={!canAdjustPrice}
                    value={
                      line.price || (effective.price === null ? '' : minorToInput(effective.price))
                    }
                    onChange={(event) => updateLine(line.key, { price: event.target.value })}
                  />
                </Field>
              </div>
              {line.serviceId && effective.price === null && (
                <p className="beauty-note">
                  {canAdjustPrice
                    ? t('Укажите окончательную цену услуги перед сохранением.')
                    : t('Для этой услуги нужна окончательная цена. Обратитесь к администратору с правом изменения цен.')}
                </p>
              )}
              {canAdjustPrice && (
                <details
                  className="appointment-line-adjustments"
                  open={
                    Boolean(
                      editing &&
                      ((line.discount !== '' && line.discount !== '0') ||
                        (line.surcharge !== '' && line.surcharge !== '0')),
                    ) || undefined
                  }
                >
                  <summary>{t('Скидка и доплата')}</summary>
                  <div className="beauty-fields-pair">
                    <Field label={t('Тип скидки')}>
                      <Select
                        aria-label={t('Тип скидки услуги {n}', { n: index + 1 })}
                        value={line.discountMode}
                        onChange={(event) =>
                          updateLine(line.key, {
                            discountMode: event.target.value as 'amount' | 'percent',
                            discount: '',
                          })
                        }
                      >
                        <option value="amount">{t('Сумма')}</option>
                        <option value="percent">{t('Процент')}</option>
                      </Select>
                    </Field>
                    <Field
                      label={
                        line.discountMode === 'percent'
                          ? t('Скидка, %')
                          : t('Скидка, {currency}', { currency: day.location.currency })
                      }
                    >
                      <Input
                        aria-label={t('Скидка услуги {n}', { n: index + 1 })}
                        inputMode={line.discountMode === 'percent' ? 'numeric' : 'decimal'}
                        value={line.discount}
                        onChange={(event) => updateLine(line.key, { discount: event.target.value })}
                      />
                    </Field>
                    <Field label={t('Доплата, {currency}', { currency: day.location.currency })}>
                      <Input
                        inputMode="decimal"
                        value={line.surcharge}
                        onChange={(event) =>
                          updateLine(line.key, { surcharge: event.target.value })
                        }
                      />
                    </Field>
                  </div>
                </details>
              )}
              {/* до выбора услуги строки нет (аудит салона 22.10.2026: «Проверьте сумму» на пустой форме) */}
              {line.serviceId && (
                <p>
                  {t('Стоимость:')}{' '}
                  {lineTotal(line) === null
                    ? t('Проверьте сумму')
                    : formatMoney(String(lineTotal(line)), day.location.currency)}
                </p>
              )}
              {lines.length > 1 && (
                <Button
                  type="button"
                  tone="secondary"
                  onClick={() =>
                    setLines((current) => current.filter((item) => item.key !== line.key))
                  }
                >
                  {t('Удалить услугу {n}', { n: index + 1 })}
                </Button>
              )}
            </fieldset>
          );
        })}
        <Button
          type="button"
          tone="secondary"
          onClick={() => setLines((current) => [...current, blankLine(nextKey.current++)])}
        >
          {t('Добавить услугу')}
        </Button>
        <div className="beauty-fields-pair">
          <Field label={t('Дата')}>
            <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={t('Время')}>
            <Input type="time" required value={hour} onChange={(e) => setHour(e.target.value)} />
          </Field>
        </div>
        <input
          type="hidden"
          name="startsAt"
          value={instantOf(`${date}T${hour}`, day.location.timezone)}
        />
        {slotMaster ? (
          <PickGroup
            title={t('Свободное время: {name}', { name: slotMaster.name })}
            facts={slotDuration > 0 ? durationText(slotDuration) : undefined}
            testId="slot-group"
            unavailable={
              date !== day.date
                ? t('на другой день время проверится при сохранении')
                : slotMaster.timeOff
                  ? t('выходной')
                  : slots.length === 0
                    ? t('свободного времени нет')
                    : undefined
            }
          >
            {slots.map((slot) => (
              <PickButton
                key={slot}
                selected={hour === slot}
                label={t('Время {time}', { time: slot })}
                disabled={pending}
                onClick={() => setHour(slot)}
              >
                {slot}
              </PickButton>
            ))}
          </PickGroup>
        ) : null}
        <p className="beauty-note">
          {t('Время филиала: {zone}. Доступность подтвердится при сохранении.', { zone: zoneLabel(day.location.timezone, t) })}
        </p>
        <p className="beauty-note sr-only" aria-live="polite">
          {t('Выбрано:')}
          <span className="beauty-selection-line">{t('Дата: {date}', { date })}</span>
          <span className="beauty-selection-line">
            {t('Время: {time} ({zone})', { time: hour, zone: zoneLabel(day.location.timezone, t) })}
          </span>
        </p>
      </fieldset>
      <fieldset className="appointment-note">
        <legend>{t('Дополнительно')}</legend>
        <Field label={t('Заметка')}>
          <Input name="notes" {...field('notes')} maxLength={2000} />
        </Field>
      </fieldset>
          </>
        }
        pickLabel={t('Выбор времени записи')}
        footer={
          <>
            <p className="appointment-form__total" aria-live="polite">
              <strong>
                {t('Итого:')}{' '}
                {validMoney
                  ? formatMoney(total.toString(), day.location.currency)
                  : t('Проверьте суммы услуг')}
                {validDuration && totalMinutes > 0 ? `, ${durationText(totalMinutes)}` : ''}
              </strong>
            </p>
            <p className="booking-shell__digest" data-testid="appointment-digest">
              {digest}
            </p>
            {/* ТЗ-1.1 F02: кнопка активна всегда; невалидная форма не отправляется (onSubmit выше), занятость решает сервер */}
            <Button type="submit" disabled={pending || state?.outcome === 'unknown'}>
              {pending
                ? editing
                  ? t('Сохраняем…')
                  : t('Записываем…')
                : editing
                  ? t('Сохранить изменения')
                  : t('Записать')}
            </Button>
          </>
        }
      />
    </form>
  );
}

export function appointmentLineDefaults(day: BeautyDay, serviceId: string, employeeId: string) {
  const service = day.services.find((item) => item.id === serviceId);
  const price = service?.masterPrices?.find((item) => item.employeeId === employeeId);
  return {
    price:
      !service || price?.priceType === 'RANGE' || price?.priceType === 'UNFIXED'
        ? null
        : price?.priceType === 'FREE'
          ? '0'
          : (price?.priceMinMinor ?? service.priceMinor),
    duration: price?.durationMinutes ?? service?.durationMinutes ?? 0,
  };
}
