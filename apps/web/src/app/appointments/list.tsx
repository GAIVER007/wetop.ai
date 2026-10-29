'use client';
import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import { Icon } from '../../components/icon';
import { DateRangePopover } from '../../components/date-range-popover';
import {
  Alert,
  Button,
  EmptyState,
  Input,
  Select,
  StatusBadge,
  Table,
} from '../../components/ui';
import type { BeautyAppointmentRow, BeautyCustomerRow, BeautyDay } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { displayDate } from '../../lib/display-date';
import { AppointmentCard } from '../beauty/appointment-card';
import { matchesAppointment } from '../beauty/calendar-columns';
import { clock, localInput } from '../beauty/time';
import { beautyStatus } from '../../lib/status/beauty';
import { AppointmentEditor } from '../beauty/appointment-editor';
import { formatPhone } from '../../lib/phone';
import { appointmentSourceLabel } from '../../lib/appointment-source';
import { intlLocale } from '../../i18n';
import { useLocale, useT } from '../../i18n/locale-provider';
import { dateFormat } from '../../i18n/dates';
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
  canCreate = !readOnly,
  canUpdate = !readOnly,
  canPay = !readOnly,
  canRefund = false,
  canIssueReview = false,
  canAdjustPrice = false,
  scopeKey = '',
  period = { from: day.date, to: day.date },
  creationUnavailableReason,
  openCreate = false,
  createFor,
}: {
  /** клиент из карточки («Записать»): форма открывается уже с ним */
  createFor?: string;
  /** `?create=1` из карточки клиента («Записать»): окно новой записи открыто сразу */
  openCreate?: boolean;
  day: BeautyDay;
  customers: BeautyCustomerRow[];
  readOnly: boolean;
  canCreate?: boolean;
  canUpdate?: boolean;
  canPay?: boolean;
  /** возврат по выполненной записи (§54) */
  canRefund?: boolean;
  canIssueReview?: boolean;
  canAdjustPrice?: boolean;
  scopeKey?: string;
  period?: { from: string; to: string };
  creationUnavailableReason?: string;
}) {
  const t = useT();
  const locale = useLocale();
  // «20 сент.» как прежде; на казахском экране месяц по-казахски
  const shortDay = (iso: string) =>
    locale === 'ru'
      ? displayDate(iso)
      : dateFormat(intlLocale(locale), { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(
          new Date(`${iso}T00:00:00Z`),
        );
  const [creating, setCreating] = useState(openCreate);
  // Non-PII context has one source: the URL (same pattern as MastersBoard).
  // Client search stays only in this scope-keyed component's memory, never in URL/history/storage.
  const [query, setQuery] = useState('');
  const router = useRouter();
  const initialParams = useSearchParams();
  const search = useSyncExternalStore(
    subscribeAddress,
    () => location.search,
    () => {
      const initial = initialParams.toString();
      return initial ? `?${initial}` : '';
    },
  );
  const params = new URLSearchParams(search);
  const services = Array.from(
    new Map(
      [
        ...day.services,
        ...day.appointments.flatMap((a) =>
          (a.items?.length ? a.items : [a]).map((item) => ({
            id: item.serviceId,
            name: item.serviceName,
          })),
        ),
      ].map((s) => [s.id, s]),
    ).values(),
  );
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
    employee: read(
      'master',
      day.columns.map((e) => e.id),
    ),
    service: read(
      'service',
      services.map((s) => s.id),
    ),
    status: read('status', Object.keys(beautyStatus)),
    appointment: read(
      'appointment',
      day.appointments.map((a) => a.id),
    ),
    query,
  };
  const { employee, service, status } = context;
  const selected = !invalid ? day.appointments.find((r) => r.id === context.appointment) : null;
  const address = (
    patch: Partial<Record<'master' | 'service' | 'status' | 'appointment', string>>,
    push = true,
  ) => {
    const url = new URL(location.href);
    url.searchParams.set('date', context.date);
    for (const [key, value] of Object.entries(patch)) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    // Preserve Next's own history state. No customer data is added to it.
    history[push ? 'pushState' : 'replaceState']({ ...history.state }, '', url);
    window.dispatchEvent(new Event('appointments-address'));
  };
  const missingSetup = !day.columns.length || !day.services.length;
  // Форма умеет начинать с клиента только через «повторить запись»: даём ей пустую запись с этим клиентом,
  // без услуги и заметок, поэтому строки услуг остаются пустыми
  const prefillCustomer = createFor ? customers.find((c) => c.id === createFor) : undefined;
  const prefill: BeautyAppointmentRow | undefined = prefillCustomer && {
    id: '',
    employeeId: day.columns[0]?.id ?? '',
    serviceId: '',
    serviceName: '',
    customer: {
      id: prefillCustomer.id,
      name: [prefillCustomer.firstName, prefillCustomer.lastName].filter(Boolean).join(' '),
      phone: prefillCustomer.phone,
    },
    startsAt: '',
    endsAt: '',
    startMinutes: day.bounds.fromMinutes,
    endMinutes: day.bounds.fromMinutes,
    status: 'BOOKED',
    next: [],
    priceMinor: '0',
    paidMinor: '0',
    refundedMinor: '0',
    currency: day.location.currency,
    notes: null,
  };
  const canStart = canCreate && !missingSetup;
  const rows = invalid
    ? []
    : day.appointments.filter(
        (r) =>
          (!status || r.status === status) &&
          matchesAppointment(r, employee, service) &&
          `${r.customer.name} ${r.customer.phone ?? ''}`
            .toLocaleLowerCase('ru')
            .includes(context.query.trim().toLocaleLowerCase('ru')),
      );
  return (
    <>
      <section className="panel beauty-list-panel" aria-label={t('Период и фильтры записей')}>
        {/* владелец 29.10.2026: период окном как в журнале, фильтры и «Новая запись» одной строкой */}
        <div className="beauty-list-bar">
          <DateRangePopover
            from={period.from || day.date}
            to={period.to || day.date}
            today={localInput(new Date().toISOString(), day.location.timezone).slice(0, 10)}
            action="/appointments"
            triggerTestId="appointments-period"
            compact
            onApply={(range) => {
              // фильтры статуса, специалиста и услуги остаются в адресе; запись и день сбрасываются
              const url = new URL(location.href);
              url.searchParams.set('from', range.from);
              url.searchParams.set('to', range.to);
              url.searchParams.delete('date');
              url.searchParams.delete('appointment');
              router.push(`${url.pathname}${url.search}`);
            }}
          />
          <Select
            aria-label={t('Статус')}
            value={status}
            onChange={(e) => address({ status: e.target.value, appointment: '' })}
          >
            <option value="">{t('Все статусы')}</option>
            {Object.entries(beautyStatus).map(([key, { label }]) => (
              <option key={key} value={key}>
                {t(label)}
              </option>
            ))}
          </Select>
          <Select
            aria-label={t('Специалист')}
            value={employee}
            onChange={(e) => address({ master: e.target.value, appointment: '' })}
          >
            <option value="">{t('Все специалисты')}</option>
            {day.columns.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label={t('Услуга')}
            value={service}
            onChange={(e) => address({ service: e.target.value, appointment: '' })}
          >
            <option value="">{t('Все услуги')}</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Input
            type="search"
            className="beauty-list-search"
            aria-label={t('Поиск клиента')}
            data-page-search
            placeholder={t('Имя или телефон')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {(status || employee || service || query) && (
            <Button
              tone="ghost"
              className="beauty-list-reset"
              onClick={() => {
                setQuery('');
                address({ master: '', service: '', status: '', appointment: '' });
              }}
            >
              {t('Сбросить фильтры')}
            </Button>
          )}
          <Button className="beauty-list-new" disabled={!canStart} onClick={() => setCreating(true)}>
            <Icon name="plus" aria-hidden="true" />
            {t('Новая запись')}
          </Button>
        </div>
        {creationUnavailableReason && <Alert>{creationUnavailableReason}</Alert>}
        {/* причина выключенной «Новой записи» видна всегда, со ссылками (аудит 21.10.2026 п.3) */}
        {canCreate && missingSetup && (
          <p className="beauty-note" role="status" data-testid="appointments-setup-hint">
            {t('Для новой записи нужны услуги и специалисты с рабочим графиком.')}{' '}
            {!day.services.length && <Link href="/services">{t('Добавить услугу')}</Link>}{' '}
            {!day.columns.length && <Link href="/employees">{t('Добавить специалиста')}</Link>}
          </p>
        )}
        {invalid && (
          <Alert>
            {t(
              'Фильтр или запись недоступны в текущем филиале. Сбросьте отбор или выберите доступные значения.',
            )}
          </Alert>
        )}
      </section>
      {rows.length === 0 ? (
        <EmptyState title={t('Записей не найдено')}>
          {t('Выберите другой период или измените фильтры.')}
        </EmptyState>
      ) : (
        <Table className="beauty-appointments-table">
          <thead>
            <tr>
              <th>{t('Дата')}</th>
              <th>{t('Время')}</th>
              <th>{t('Клиент')}</th>
              <th>{t('Телефон')}</th>
              <th>{t('Услуга')}</th>
              <th>{t('Специалист')}</th>
              <th>{t('Статус')}</th>
              <th>{t('Источник')}</th>
              <th data-col="author">{t('Автор')}</th>
              <th className="beauty-amount">{t('Стоимость')}</th>
              <th>{t('Действия')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const services = r.items?.length ? r.items.map((item) => item.serviceName).join(', ') : r.serviceName;
              const staff = r.items?.length
                ? [...new Set(r.items.map((item) => item.employeeName))].join(', ')
                : (day.columns.find((e) => e.id === r.employeeId)?.name ?? t('Специалист в архиве'));
              return (
              <tr key={r.id}>
                <td data-label={t('Дата')} data-col="date">
                  {shortDay(localInput(r.startsAt, day.location.timezone).slice(0, 10))}
                </td>
                <td data-label={t('Время')} data-col="time">
                  {clock(r.startMinutes)}–{clock(r.endMinutes)}
                </td>
                <td data-label={t('Клиент')} data-col="client" title={r.customer.name}>
                  <Button size="sm" tone="ghost" onClick={() => address({ appointment: r.id })}>
                    {r.customer.name}
                  </Button>
                </td>
                <td
                  data-label={t('Телефон')}
                  className={
                    r.customer.phone ? 'beauty-contact' : 'beauty-contact beauty-contact--empty'
                  }
                >
                  {r.customer.phone ? (
                    <a href={`tel:${r.customer.phone}`}>{formatPhone(r.customer.phone)}</a>
                  ) : (
                    t('Не указан')
                  )}
                </td>
                <td data-label={t('Услуга')} data-col="service" title={services}>
                  {services}
                </td>
                <td data-label={t('Специалист')} data-col="staff" title={staff}>
                  {staff}
                </td>
                <td data-label={t('Статус')} data-col="status">
                  <StatusBadge kind="beauty" value={r.status} />
                </td>
                <td data-label={t('Источник')} data-col="source">{t(appointmentSourceLabel(r.source))}</td>
                <td data-label={t('Автор')} data-col="author" title={r.createdByName ?? undefined}>
                  {r.createdByName ?? '-'}
                </td>
                <td data-label={t('Стоимость')} data-col="price" className="beauty-amount">
                  {formatMoney(r.priceMinor, r.currency)}
                </td>
                <td data-label={t('Действия')} data-col="actions">
                  <Button tone="secondary" onClick={() => address({ appointment: r.id })}>
                    {t('Открыть запись')}
                  </Button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      <AppointmentEditor
        canAdjustPrice={canAdjustPrice}
        open={canStart && creating}
        onClose={() => setCreating(false)}
        scopeKey={scopeKey}
        day={day}
        customers={customers}
        employeeId={day.columns[0]?.id ?? ''}
        time={clock(day.bounds.fromMinutes)}
        {...(prefill ? { repeatFrom: prefill } : {})}
        onDone={() => {
          setCreating(false);
          router.refresh();
        }}
      />
      <Overlay
        open={Boolean(selected)}
        onClose={() => address({ appointment: '' }, false)}
        title={t('Запись')}
        size="lg"
        className="appointment-card-modal"
      >
        {selected && (
          <AppointmentCard
            canAdjustPrice={canAdjustPrice}
            scopeKey={scopeKey}
            day={day}
            row={selected}
            canCreate={canCreate}
            canUpdate={canUpdate}
            canPay={canPay}
            canRefund={canRefund}
            canIssueReview={canIssueReview}
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
