'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { Alert, Button, Field, Input, Select } from '../../components/ui';
import { matchesCustomer } from '../../lib/customer-match';
import { APPOINTMENT_DESK_SOURCES } from '@pms/domain';
import { appointmentSourceLabel } from '../../lib/appointment-source';
import type { BeautyAppointmentRow, BeautyCustomerRow, BeautyDay } from '../../lib/api';
import { formatMoney, inputToMinor, minorToInput } from '../../lib/money';
import { createAppointment, moveAppointment } from './journal-actions';
import { instantOf, localInput } from './time';
import { zoneLabel } from '../../lib/human-period';
import { formatPhone, formatPhoneInput } from '../../lib/phone';
import { BookingShell, PickButton, PickHeading } from '../../components/booking-shell';
import { masterDayMap } from './master-map';
import { useT } from '../../i18n/locale-provider';
import { Icon } from '../../components/icon';

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
    notes: source?.notes ?? '',
    employeeId,
  });
  // выезд на дом (владелец 27.10.2026): у повтора записи и изменения берётся из исходной записи
  const [atHome, setAtHome] = useState(Boolean(source?.atHome));
  const [homeAddress, setHomeAddress] = useState(source?.homeAddress ?? '');
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
  // имя и телефон отдельными полями (владелец 28.10.2026: «где поля имя и номер телефона, как отдельно должно быть»);
  // по обоим ниже ищутся клиенты из базы, как раньше по одному полю
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const customerSearch = `${customerName} ${customerPhone}`.trim();
  // откуда клиент (владелец 28.10.2026): Instagram, WhatsApp, звонок, пришёл сам; без выбора «Администратор»
  const [clientSource, setClientSource] = useState<string>('DESK');
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
  const nameWords = customerName.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const newCustomer = { firstName: nameWords[0] ?? '', lastName: nameWords.slice(1).join(' '), phone: customerPhone.trim() };
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
    draft.notes !== (source?.notes ?? '') ||
    atHome !== Boolean(source?.atHome) ||
    homeAddress !== (source?.homeAddress ?? '') ||
    draft.employeeId !== initial.current.employeeId ||
    date !== initial.current.date ||
    hour !== initial.current.time ||
    JSON.stringify(lines) !== initialLines.current ||
    customerId !== (repeatFrom?.customer.id ?? '') ||
    clientSource !== 'DESK' ||
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
  // Окно записи вариант A (владелец 26.10.2026): справа мастера карточками и свободное время сеткой
  // (утро, день, вечер); занятое серым. Только мастера первой услуги, длительность всего визита
  const dayMap =
    date === day.date && slotDuration > 0
      ? masterDayMap(
          day.columns,
          day.appointments.filter((a) => a.id !== editing?.id),
          slotDuration,
          lines[0]?.serviceId ?? '',
          nowLocal.slice(0, 10) === day.date
            ? Number(nowLocal.slice(11, 13)) * 60 + Number(nowLocal.slice(14, 16))
            : undefined,
        )
      : null;
  const masterRow = dayMap?.rows.find((row) => row.id === lines[0]?.employeeId);
  const dayParts = (
    [
      [t('Утро'), 0, 12 * 60],
      [t('День'), 12 * 60, 17 * 60],
      [t('Вечер'), 17 * 60, 24 * 60],
    ] as const
  )
    .map(([title, from, to]) => ({
      title,
      cells: (masterRow?.cells ?? []).filter((cell) => {
        const m = Number(cell.time.slice(0, 2)) * 60 + Number(cell.time.slice(3, 5));
        return m >= from && m < to;
      }),
    }))
    .filter((part) => part.cells.length > 0);
  const sellable = day.services.filter((service) => service.sellable);
  const categories = [...new Set(sellable.map((service) => service.category).filter(Boolean))] as string[];
  const [category, setCategory] = useState('');
  const [needService, setNeedService] = useState(false);
  const shownServices = sellable.filter((service) => !category || service.category === category);
  const pickService = (serviceId: string) => {
    setNeedService(false);
    const first = lines[0];
    if (!first) return;
    const master =
      day.columns.find((c) => c.id === first.employeeId && c.serviceIds.includes(serviceId)) ??
      day.columns.find((c) => c.serviceIds.includes(serviceId) && !c.timeOff);
    selectLine(first, { serviceId, employeeId: master?.id ?? first.employeeId });
  };
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
        if (lines.length === 1 && !lines[0]?.serviceId) {
          event.preventDefault();
          setNeedService(true);
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
          {pickedCustomer ? (
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
          ) : (
            <>
              <div className="appointment-customer-row">
                <Field label={t('Имя клиента')}>
                  <Input
                    type="search"
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    autoComplete="off"
                    required={!customerId}
                    maxLength={160}
                  />
                </Field>
                <Field label={t('Телефон')}>
                  <Input
                    type="tel"
                    inputMode="tel"
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(formatPhoneInput(event.target.value))}
                    autoComplete="off"
                    maxLength={32}
                  />
                </Field>
              </div>
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
                        setCustomerName('');
                        setCustomerPhone('');
                      }}
                    >
                      {`${[c.firstName, c.lastName].filter(Boolean).join(' ')}${c.phone ? `, ${formatPhone(c.phone)}` : ''}`}
                    </Button>
                  ))}
                </div>
              )}
              {search && !newCustomer.firstName && (
                <p className="appointment-customer-new" data-testid="appointment-customer-new">
                  {t('Добавьте имя клиента к номеру')}
                </p>
              )}
              <div className="appointment-customer-quick">
                <Button
                  type="button"
                  size="sm"
                  tone="secondary"
                  onClick={() => setCustomerName('Гость')} // kk-allow: имя клиента сохраняется в базу как данные
                >
                  {t('Гость')}
                </Button>
                {lastPickedCustomerId && customers.some((c) => c.id === lastPickedCustomerId) && (
                  <Button
                    type="button"
                    size="sm"
                    tone="secondary"
                    onClick={() => lastPickedCustomerId && setCustomerId(lastPickedCustomerId)}
                  >
                    {t('Последний клиент')}
                  </Button>
                )}
              </div>
            </>
          )}
          {!editing && (
            <div className="appointment-source" role="group" aria-label={t('Откуда клиент')}>
              <span className="appointment-source__title">{t('Откуда клиент')}</span>
              {APPOINTMENT_DESK_SOURCES.filter((key) => key !== 'DESK').map((key) => (
                <button
                  key={key}
                  type="button"
                  className="appointment-source__chip"
                  aria-pressed={clientSource === key}
                  onClick={() => setClientSource(clientSource === key ? 'DESK' : key)}
                >
                  {t(appointmentSourceLabel(key))}
                </button>
              ))}
              <input type="hidden" name="source" value={clientSource} />
            </div>
          )}
          <input type="hidden" name="customerId" value={customerId} />
          {!customerId && (
            <>
              <input type="hidden" name="firstName" value={newCustomer.firstName} />
              <input type="hidden" name="lastName" value={newCustomer.lastName} />
              <input type="hidden" name="phone" value={newCustomer.phone} />
            </>
          )}
        </fieldset>
      )}
      <fieldset className="appointment-pick">
        <legend>{t('Услуга и время')}</legend>
        {!editing && lines.length === 1 && (
          <div className="appointment-services" data-testid="service-cards">
            {categories.length > 1 && (
              <div className="appointment-services__cats">
                <PickButton wide selected={category === ''} label={t('Все услуги')} onClick={() => setCategory('')}>
                  {t('Все')}
                </PickButton>
                {categories.map((name) => (
                  <PickButton key={name} wide selected={category === name} label={name} onClick={() => setCategory(name)}>
                    {name}
                  </PickButton>
                ))}
              </div>
            )}
            <div className="appointment-services__list" role="group" aria-label={t('Выбор услуги')}>
              {shownServices.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  className="appointment-services__card"
                  aria-pressed={lines[0]?.serviceId === service.id}
                  onClick={() => pickService(service.id)}
                >
                  <b>{service.name}</b>
                  <span>{durationText(service.durationMinutes)}</span>
                  <strong>{formatMoney(service.priceMinor, day.location.currency)}</strong>
                </button>
              ))}
            </div>
            {needService && <p className="beauty-note" role="alert">{t('Выберите услугу')}</p>}
          </div>
        )}
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
              <Field label={t('Услуга')} className={lines.length === 1 ? 'sr-only' : undefined}>
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
              <Field label={t('Специалист')} className={lines.length === 1 ? 'sr-only' : undefined}>
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
      </fieldset>
      {state?.error && <Alert>{state.error}</Alert>}
          </>
        }
        pick={
          <>
            <PickHeading
              title={t('Мастер и время')}
              note={slotDuration > 0 ? durationText(slotDuration) : t('Выберите услугу')}
            />
        <div className="beauty-fields-pair appointment-when">
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
            {dayMap && dayMap.rows.length > 0 && (
              <div className="appointment-masters" role="group" aria-label={t('Выбор мастера')}>
                {dayMap.rows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className="appointment-masters__card"
                    data-testid="master-card"
                    aria-pressed={row.id === lines[0]?.employeeId}
                    disabled={row.timeOff || pending}
                    onClick={() => lines[0] && selectLine(lines[0], { employeeId: row.id })}
                  >
                    <span className="appointment-masters__avatar" aria-hidden="true">
                      {row.name.slice(0, 1)}
                    </span>
                    <b>{row.name}</b>
                    <small>
                      {row.timeOff ? t('выходной') : t('свободно {n}', { n: row.free })}
                    </small>
                  </button>
                ))}
              </div>
            )}
            {slotMaster && (
              <div className="appointment-slots" data-testid="slot-group">
                {date !== day.date ? (
                  <p className="booking-pick__muted">{t('на другой день время проверится при сохранении')}</p>
                ) : slotMaster.timeOff ? (
                  <p className="booking-pick__muted">{t('выходной')}</p>
                ) : !masterRow || masterRow.free === 0 ? (
                  <p className="booking-pick__muted">{t('свободного времени нет')}</p>
                ) : (
                  dayParts.map((part) => (
                    <div key={part.title} className="appointment-slots__part">
                      <span className="appointment-slots__title">{part.title}</span>
                      <div className="appointment-slots__grid">
                        {part.cells.map((cell) => (
                          <PickButton
                            key={cell.time}
                            selected={hour === cell.time}
                            label={
                              cell.state === 'free'
                                ? t('Время {time}', { time: cell.time })
                                : t('{time} занято', { time: cell.time })
                            }
                            disabled={cell.state !== 'free' || pending}
                            onClick={() => setHour(cell.time)}
                          >
                            {cell.time}
                          </PickButton>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
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
            {/* заметка справа под временем: левая колонка на один экран (26.10.2026) */}
      <fieldset className="appointment-note">
        <legend>{t('Дополнительно')}</legend>
        <label className="beauty-check">
          <input type="checkbox" name="atHome" checked={atHome} onChange={(e) => setAtHome(e.target.checked)} />
          <Icon name="pin" aria-hidden="true" />
          <span>{t('Выезд на дом')}</span>
        </label>
        {atHome && (
          <Field label={t('Адрес выезда')}>
            <Input
              name="homeAddress"
              required
              maxLength={300}
              autoComplete="street-address"
              value={homeAddress}
              onChange={(e) => setHomeAddress(e.target.value)}
            />
          </Field>
        )}
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
