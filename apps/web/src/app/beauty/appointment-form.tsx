'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { Alert, Button, Field, Input, Select } from '../../components/ui';
import type { BeautyAppointmentRow, BeautyCustomerRow, BeautyDay } from '../../lib/api';
import { formatMoney, inputToMinor, minorToInput } from '../../lib/money';
import { createAppointment, moveAppointment } from './journal-actions';
import { instantOf, localInput } from './time';

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
  const source = editing ?? repeatFrom;
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
          error: 'Результат не подтверждён. Проверьте список записей перед повторным созданием.',
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
  const validMoney = totals.every((value) => value !== null);
  const validDuration = lines.every((line) => {
    const minutes = Number(line.duration || effectiveFor(line).duration);
    return Number.isInteger(minutes) && minutes > 0 && minutes <= 1440;
  });
  const total = totals.reduce<bigint>((sum, value) => sum + (value ?? 0n), 0n);
  const search = customerSearch.trim().toLocaleLowerCase();
  const matchingCustomers = customers.filter(
    (customer) =>
      customer.status !== 'ARCHIVED' &&
      (!search ||
        `${customer.firstName} ${customer.lastName ?? ''} ${customer.phone ?? ''}`
          .toLocaleLowerCase()
          .includes(search) ||
        (search.replace(/\D/g, '').length > 2 &&
          (customer.phone ?? '').replace(/\D/g, '').includes(search.replace(/\D/g, '')))),
  );

  const [customerId, setCustomerId] = useState(repeatFrom?.customer.id ?? '');
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
      {!editing && (
        <fieldset className="appointment-customer-fields">
          <legend>Клиент</legend>
          <Field label="Телефон или имя">
            <Input
              type="search"
              value={customerSearch}
              onChange={(event) => setCustomerSearch(event.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field label="Клиент">
            <Select
              name="customerId"
              aria-label="Клиент"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">Новый клиент</option>
              {repeatFrom && !matchingCustomers.some((c) => c.id === repeatFrom.customer.id) && (
                <option value={repeatFrom.customer.id}>{repeatFrom.customer.name}</option>
              )}
              {matchingCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {`${[c.firstName, c.lastName].filter(Boolean).join(' ')}${c.phone ? `, ${c.phone}` : ''}`}
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
        </fieldset>
      )}
      <fieldset>
        <legend>Услуги</legend>
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
              <legend>Услуга {index + 1}</legend>
              <Field label="Услуга">
                <Select
                  aria-label={index === 0 ? 'Услуга' : `Услуга ${index + 1}`}
                  required
                  value={line.serviceId}
                  onChange={(event) => selectLine(line, { serviceId: event.target.value })}
                >
                  <option value="" disabled>
                    Выберите услугу
                  </option>
                  {day.services
                    .filter((service) => service.sellable)
                    .map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}, {service.durationMinutes} мин
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Специалист">
                <Select
                  aria-label={index === 0 ? 'Специалист' : `Специалист услуги ${index + 1}`}
                  required
                  value={line.employeeId}
                  onChange={(event) => selectLine(line, { employeeId: event.target.value })}
                >
                  <option value="" disabled>
                    Выберите специалиста
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
                  <span className="field">Длительность</span>
                  <div className="appointment-duration-controls">
                    <Field label={<span className="sr-only">Часы</span>}>
                      <Select
                        aria-label={`Часы услуги ${index + 1}`}
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
                            {hours} ч
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={<span className="sr-only">Минуты</span>}>
                      <Select
                        aria-label={`Минуты услуги ${index + 1}`}
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
                            {String(minutes).padStart(2, '0')} мин
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                </div>
                <Field label={`Цена, ${day.location.currency}`}>
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
                    ? 'Укажите окончательную цену услуги перед сохранением.'
                    : 'Для этой услуги нужна окончательная цена. Обратитесь к администратору с правом изменения цен.'}
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
                  <summary>Скидка и доплата</summary>
                  <div className="beauty-fields-pair">
                    <Field label="Тип скидки">
                      <Select
                        aria-label={`Тип скидки услуги ${index + 1}`}
                        value={line.discountMode}
                        onChange={(event) =>
                          updateLine(line.key, {
                            discountMode: event.target.value as 'amount' | 'percent',
                            discount: '',
                          })
                        }
                      >
                        <option value="amount">Сумма</option>
                        <option value="percent">Процент</option>
                      </Select>
                    </Field>
                    <Field
                      label={
                        line.discountMode === 'percent'
                          ? 'Скидка, %'
                          : `Скидка, ${day.location.currency}`
                      }
                    >
                      <Input
                        aria-label={`Скидка услуги ${index + 1}`}
                        inputMode={line.discountMode === 'percent' ? 'numeric' : 'decimal'}
                        value={line.discount}
                        onChange={(event) => updateLine(line.key, { discount: event.target.value })}
                      />
                    </Field>
                    <Field label={`Доплата, ${day.location.currency}`}>
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
              <p>
                Стоимость:{' '}
                {lineTotal(line) === null
                  ? 'Проверьте сумму'
                  : formatMoney(String(lineTotal(line)), day.location.currency)}
              </p>
              {lines.length > 1 && (
                <Button
                  type="button"
                  tone="secondary"
                  onClick={() =>
                    setLines((current) => current.filter((item) => item.key !== line.key))
                  }
                >
                  Удалить услугу {index + 1}
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
          Добавить услугу
        </Button>
        <p aria-live="polite">
          <strong>
            Итого:{' '}
            {validMoney
              ? formatMoney(total.toString(), day.location.currency)
              : 'Проверьте суммы услуг'}
          </strong>
        </p>
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
        <p className="beauty-note">
          Время филиала: {day.location.timezone}. Доступность подтвердится при сохранении.
        </p>
        <p className="beauty-note" aria-live="polite">
          Выбрано:
          <span className="beauty-selection-line">Дата: {date}</span>
          <span className="beauty-selection-line">
            Время: {hour} ({day.location.timezone})
          </span>
        </p>
      </fieldset>
      <fieldset>
        <legend>Дополнительно</legend>
        <Field label="Заметка">
          <Input name="notes" {...field('notes')} maxLength={2000} />
        </Field>
      </fieldset>
      {state?.error && <Alert>{state.error}</Alert>}
      <div className="appointment-form__footer">
        <Button
          type="submit"
          disabled={pending || !validMoney || !validDuration || state?.outcome === 'unknown'}
        >
          {pending ? 'Сохраняем…' : editing ? 'Сохранить изменения' : 'Записать'}
        </Button>
      </div>
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
