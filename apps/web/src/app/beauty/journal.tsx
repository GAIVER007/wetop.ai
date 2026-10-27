'use client';
import Link from 'next/link';
import { useOptimistic, useState, useTransition, type ReactNode } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { EmployeeFilter } from '../../components/employee-filter';
import { QuickReport } from '../../components/quick-report';
import { FoldVertical } from 'lucide-react';
import { Icon } from '../../components/icon';
import { JournalExpandButton } from '../../components/journal-expand';
import { beautyQuickReport } from '../../components/quick-report-data';
import { Overlay } from '../../components/overlay';
import { Alert, Badge, Button, EmptyState, Help } from '../../components/ui';
import type {
  BeautyAppointmentRow,
  BeautyCustomerRow,
  BeautyDay,
  BeautyDayColumn,
  BeautyEmployeeRow,
} from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { monthHref } from './month-href';
import { matchesCustomer } from '../../lib/customer-match';
import { AppointmentCard } from './appointment-card';
import { AppointmentEditor } from './appointment-editor';
import {
  appointmentSegments,
  calendarColumns,
  matchesAppointment,
  mobileDefaultMaster,
} from './calendar-columns';
import { DayNav } from '../../components/day-nav';
import { JournalFilter, JournalHead, JournalSearch, FiltersTitle } from '../../components/journal-head';
import { useNarrow, useWide } from '../../lib/use-narrow';
import { DayPanel } from './day-panel';
import { masterLoad, shortHour, shortName, tilePayment } from './journal-day';
import { clock, clockMinutes, instantOf, localInput } from './time';
import { beautyPeriodRows, moveAppointment } from './journal-actions';
import { beautyStatus } from '../../lib/status/beauty';
import { StatusChips } from './calendar-legend';
import { useT } from '../../i18n/locale-provider';

const STEP = 30;
type Panel =
  | { kind: 'new'; employeeId: string; time: string }
  | { kind: 'card'; row: BeautyAppointmentRow }
  | null;

export function JournalBoard({
  day,
  customers,
  employees,
  readOnly,
  canCreate = !readOnly,
  canUpdate = !readOnly,
  canPay = !readOnly,
  canRefund = false,
  canIssueReview = false,
  canAdjustPrice = false,
  appointmentId,
  newFor,
  scopeKey = '',
  creationUnavailableReason,
  views,
}: {
  day: BeautyDay;
  customers: BeautyCustomerRow[];
  employees: BeautyEmployeeRow[];
  readOnly: boolean;
  canCreate?: boolean;
  canUpdate?: boolean;
  canPay?: boolean;
  /** возврат по выполненной записи (§54): право `refunds` */
  canRefund?: boolean;
  canIssueReview?: boolean;
  canAdjustPrice?: boolean;
  appointmentId?: string | undefined;
  /** «Новая запись» из карточки мастера (`?new=1&employee=`): форма открыта сразу к этому мастеру */
  newFor?: string | undefined;
  scopeKey?: string;
  creationUnavailableReason?: string;
  /** «День / Неделя» в строке инструментов рядом с датой (аудит 21.10.2026, п. 34) */
  views?: ReactNode;
}) {
  const t = useT();
  const columns = calendarColumns(day, employees, t);
  const [compact, setCompact] = useState(false);
  const [query, setQuery] = useState('');
  const narrow = useNarrow();
  // панель дня справа от сетки: на широком экране (вариант B, 24.10.2026); на телефоне карточка открывается сразу
  const wide = useWide();
  const [picked, setPicked] = useState<string | null>(null);
  const PX_PER_MIN = compact ? 1 : 1.5;
  const [panel, setPanel] = useState<Panel>(() => {
    const row = day.appointments.find((item) => item.id === appointmentId);
    if (row) return { kind: 'card', row };
    // из карточки мастера: начало его часов в этот день, иначе начало дня журнала (аудит 22.10.2026)
    const master = newFor ? day.columns.find((c) => c.id === newFor) : undefined;
    if (!master || !canCreate) return null;
    return {
      kind: 'new',
      employeeId: master.id,
      time: master.intervals[0]?.timeFrom ?? clock(day.bounds.fromMinutes),
    };
  });
  const params = useSearchParams();
  const pathname = usePathname();
  const [filters, updateFilters] = useOptimistic(
    {
      employee: params.get('employee') ?? '',
      service: params.get('service') ?? '',
      status: params.get('status') ?? '',
    },
    (current, change: Partial<{ employee: string; service: string; status: string }>) => ({
      ...current,
      ...change,
    }),
  );
  const { employee: master, service, status } = filters;
  const selected = master || mobileDefaultMaster(columns, appointmentSegments(day.appointments));
  const router = useRouter();
  const [filterPending, startFilterTransition] = useTransition();
  const applyFilters = (next: typeof filters) => {
    startFilterTransition(() => {
      updateFilters(next);
      const query = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value) query.set(key, value);
        else query.delete(key);
      }
      router.replace(`${pathname}?${query}`, { scroll: false });
    });
  };
  // адрес дня журнала: фильтры остаются, «Сегодня» без даты (как прежний DateBar)
  const dayHref = (next?: string) => {
    const query = new URLSearchParams(params.toString());
    query.delete('view');
    if (next) query.set('date', next);
    else query.delete('date');
    return `${pathname}?${query}`;
  };
  const setFilter = (key: keyof typeof filters, value: string) =>
    applyFilters({ ...filters, [key]: value });
  const setMaster = (value: string) => setFilter('employee', value);
  const setService = (value: string) => setFilter('service', value);
  const setStatus = (value: string) => setFilter('status', value);
  const [dragged, setDragged] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [moveError, setMoveError] = useState('');
  const [moving, startMove] = useTransition();
  const movable = (row: BeautyAppointmentRow) =>
    canUpdate && !moving && (row.status === 'BOOKED' || row.status === 'CONFIRMED');
  // линия «сейчас» только на сегодняшнем дне филиала, минуты по поясу филиала
  const [nowMinutes] = useState<number | null>(() => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: day.location.timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    if (`${get('year')}-${get('month')}-${get('day')}` !== day.date) return null;
    return Number(get('hour')) * 60 + Number(get('minute'));
  });
  const from = Math.floor(day.bounds.fromMinutes / STEP) * STEP;
  const to = Math.ceil(day.bounds.toMinutes / STEP) * STEP;
  const slots = Array.from({ length: (to - from) / STEP }, (_, i) => from + i * STEP);
  const height = (to - from) * PX_PER_MIN;
  // поиск в строке отборов: имя или телефон клиента (единая шапка 24.10.2026)
  const found = (a: BeautyAppointmentRow) => matchesCustomer(query, a.customer);
  const reportRows = day.appointments.filter(
    (a) => matchesAppointment(a, master, service) && (!status || a.status === status) && found(a),
  );
  const buildReport = (periodRows?: unknown[]) =>
    beautyQuickReport(
      periodRows
        ? (periodRows as BeautyAppointmentRow[]).filter(
            (a) => matchesAppointment(a, master, service) && (!status || a.status === status),
          )
        : reportRows,
    );
  const segments = appointmentSegments(day.appointments);
  const live = reportRows.filter((a) => a.status !== 'CANCELLED');
  const shown = master ? columns.filter((c) => c.id === master) : columns;
  // 5 и больше мастеров: узкие колонки, короткие подписи (владелец 24.10.2026: «а если мастеров 5+»)
  const dense = shown.length >= 5 && !narrow;
  const initials = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(-2)
      .map((w) => w.charAt(0).toUpperCase())
      .join('');
  const done = () => {
    setPanel(null);
    router.refresh();
  };
  // запись создать не из чего: нет услуг или специалистов с графиком (аудит 21.10.2026, п. 13, 15, 36)
  const notReady = !columns.length || !day.services.length;
  const nowLine = nowMinutes !== null && nowMinutes >= from && nowMinutes <= to && (
    <div
      className="beauty-now"
      data-testid="beauty-now"
      aria-hidden="true"
      style={{ top: (nowMinutes - from) * PX_PER_MIN }} /* slop-allow: inline-style положение линии «сейчас» */
    />
  );
  const column = (employee: BeautyDayColumn) => (
    <div
      className="beauty-col-body"
      style={{ height }} /* slop-allow: inline-style высота колонки из длины рабочего дня */
    >
      {nowLine}
      {slots.map((m) => {
        const works =
          !employee.timeOff &&
          employee.intervals.some(
            (i) => clockMinutes(i.timeFrom) <= m && m + STEP <= clockMinutes(i.timeTo),
          );
        const occupied = segments.some(
          (a) =>
            a.employeeId === employee.id &&
            a.status !== 'CANCELLED' &&
            a.status !== 'NO_SHOW' &&
            a.startMinutes < m + STEP &&
            m < a.endMinutes,
        );
        const slot = { top: (m - from) * PX_PER_MIN, height: STEP * PX_PER_MIN };
        const target = `${employee.id}:${m}`;
        const draggedRow = day.appointments.find((row) => row.id === dragged);
        const canDrop = works && !occupied && draggedRow && movable(draggedRow);
        return (
          <div
            key={m}
            className={`beauty-slot${works ? '' : ' beauty-slot--off'}${dropTarget === target ? ' beauty-slot--drop' : ''}`}
            style={slot} /* slop-allow: inline-style место слота из минут расписания */
            onDragOver={(event) => {
              if (!canDrop) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setDropTarget(target);
            }}
            onDragLeave={() => setDropTarget((current) => (current === target ? null : current))}
            onDrop={(event) => {
              if (!canDrop) return;
              event.preventDefault();
              setDragged(null);
              setDropTarget(null);
              setMoveError('');
              const form = new FormData();
              form.set('id', draggedRow.id);
              form.set('employeeId', employee.id);
              form.set('startsAt', instantOf(`${day.date}T${clock(m)}`, day.location.timezone));
              startMove(async () => {
                const result = await moveAppointment(null, form);
                if (result.error) setMoveError(result.error);
                else router.refresh();
              });
            }}
          >
            {!works &&
              (m === from || employee.intervals.some((i) => clockMinutes(i.timeTo) === m)) && (
                <span className="beauty-slot-state">{t('Вне графика')}</span>
              )}
            {works && !occupied && (
              <button
                type="button"
                className="beauty-slot-free"
                disabled={!canCreate}
                aria-label={t('{name}, {time}, свободно', { name: employee.name, time: clock(m) })}
                data-time={`+ ${clock(m)}`}
                onClick={() => setPanel({ kind: 'new', employeeId: employee.id, time: clock(m) })}
              />
            )}
          </div>
        );
      })}
      {segments
        .filter(
          (a) =>
            a.employeeId === employee.id &&
            a.status !== 'CANCELLED' &&
            a.status !== 'NO_SHOW' &&
            !live.some((visible) => visible.id === a.id),
        )
        .map((a) => (
          <div
            key={`hidden-${a.segmentKey}`}
            className="beauty-tile beauty-tile--hidden"
            style={{ top: (a.startMinutes - from) * PX_PER_MIN, height: Math.max(24, a.endMinutes - a.startMinutes) * PX_PER_MIN }} /* slop-allow: inline-style положение и высота скрытой записи из минут визита */
          >
            <span>
              {clock(a.startMinutes)}–{clock(a.endMinutes)}
            </span>
            <strong>{t('Занято, скрыто фильтром')}</strong>
          </div>
        ))}
      {appointmentSegments(live)
        .filter((a) => a.employeeId === employee.id)
        .map((a) => (
          <button
            key={a.segmentKey}
            type="button"
            draggable={movable(a) && a.startsAt === a.appointment.startsAt}
            onDragStart={(event) => {
              if (!movable(a) || a.startsAt !== a.appointment.startsAt) {
                event.preventDefault();
                return;
              }
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', a.id);
              setDragged(a.id);
              setMoveError('');
            }}
            onDragEnd={() => {
              setDragged(null);
              setDropTarget(null);
            }}
            className={`beauty-tile beauty-tile--${a.status.toLowerCase()}`}
            style={{ top: (a.startMinutes - from) * PX_PER_MIN, height: Math.max(24, a.endMinutes - a.startMinutes) * PX_PER_MIN }} /* slop-allow: inline-style положение и высота записи из минут визита */
            title={[
              `${clock(a.startMinutes)}–${clock(a.endMinutes)}`,
              a.customer.name,
              a.serviceName,
              ...(a.appointment.atHome ? [t('Выезд на дом')] : []),
              formatMoney(a.priceMinor, a.currency),
              ...(tilePayment(a.appointment) ? [t(tilePayment(a.appointment)!.full)] : []),
              t(beautyStatus[a.status].label),
            ].join(', ')}
            onClick={() => {
              // щелчок открывает карточку, как раньше, и показывает запись в панели дня справа
              setPicked(a.appointment.id);
              setPanel({ kind: 'card', row: a.appointment });
            }}
            aria-pressed={wide ? picked === a.appointment.id : undefined}
          >
            {/* плашка читается целиком (владелец 25.10.2026): время и клиент сверху, услуга своей строкой (две, если
                хватает высоты), цена и оплата значком «точка + слово», полное слово в подсказке; статус словом */}
            <span className="beauty-tile-top">
              <span className="beauty-tile-time">
                {clock(a.startMinutes)}–{clock(a.endMinutes)}
              </span>
              <strong className="beauty-tile-name">{a.customer.name}</strong>
            </span>
            <span className="beauty-tile-service">
              {a.appointment.atHome && <Icon name="pin" aria-label={t('Выезд на дом')} />}
              {a.serviceName}
            </span>
            <span className="beauty-tile-money">
              <b>{formatMoney(a.priceMinor, a.currency)}</b>
              {(() => {
                const pay = tilePayment(a.appointment);
                return (
                  pay && (
                    <span
                      className={`beauty-tile-pay beauty-tile-pay--${pay.kind}`}
                      title={t(pay.full)}
                    >
                      <span className="beauty-tile-dot" aria-hidden="true"></span>
                      {t(pay.word)}
                    </span>
                  )
                );
              })()}
              <span className="beauty-tile-status">{t(beautyStatus[a.status].label)}</span>
            </span>
          </button>
        ))}
    </div>
  );
  const hours = (
    <div
      className="beauty-hours"
      style={/* slop-allow: inline-style высота шкалы из минут расписания */ { height }}
      aria-hidden="true"
    >
      {slots.map((m) => (
        <div
          key={m}
          className="beauty-hour"
          style={{ height: STEP * PX_PER_MIN }} /* slop-allow: inline-style высота шага из минут расписания */
        >
          {clock(m)}
        </div>
      ))}
    </div>
  );
  const quickReport = (
    <QuickReport
      text={t('Быстрый отчёт')}
      key={`${day.date}:${master}:wide`}
      date={day.date}
      scope={[
        day.location.name ?? t('Салон'),
        master
          ? (columns.find((c) => c.id === master)?.name ?? t('Специалист недоступен'))
          : t('Все специалисты'),
        ...(service || status ? [t('С учётом фильтров журнала')] : []),
      ]}
      build={buildReport}
      loadPeriod={beautyPeriodRows}
    />
  );
  const quickReportPhone = (
    <QuickReport
      key={`${day.date}:${master}:phone`}
      text={t('Быстрый отчёт')}
      date={day.date}
      scope={[
        day.location.name ?? t('Салон'),
        master
          ? (columns.find((c) => c.id === master)?.name ?? t('Специалист недоступен'))
          : t('Все специалисты'),
        ...(service || status ? [t('С учётом фильтров журнала')] : []),
      ]}
      build={buildReport}
      loadPeriod={beautyPeriodRows}
    />
  );
  const serviceFilter = (
    <JournalFilter
      label={t('Услуга')}
      allLabel={t('Все услуги')}
      value={service}
      onChange={setService}
      options={day.services.map((sv) => ({ value: sv.id, label: sv.name }))}
    />
  );
  const statusFilter = (
    <JournalFilter
      label={t('Статус записи')}
      allLabel={t('Все статусы')}
      value={status}
      onChange={setStatus}
      options={Object.entries(beautyStatus)
        .filter(([key]) => key !== 'CANCELLED')
        .map(([value, st]) => ({ value, label: t(st.label) }))}
    />
  );
  return (
    <>
      <JournalHead
        title={t('Журнал')}
        subtitle={
          day.location.name
            ? t('Расписание специалистов и услуг, {name}', { name: day.location.name })
            : t('Расписание специалистов и услуг')
        }
        nav={
          <DayNav
            date={day.date}
            today={localInput(new Date().toISOString(), day.location.timezone).slice(0, 10)}
            testId="beauty-day-nav"
            onGo={(next) => router.push(dayHref(next))}
            onToday={() => router.push(dayHref())}
            onWeek={() => router.push(`${dayHref(day.date)}&view=week`)}
            // «Этот месяц»: реестр записей за месяц (`/appointments?from=&to=`), отдельной сетки месяца у журнала нет
            onMonth={() => router.push(monthHref(localInput(new Date().toISOString(), day.location.timezone).slice(0, 10)))}
          />
        }
        actions={
          <>
            <span className="journal-head__desk-only">
              {/* «Компактный вид» значком рядом с «На весь экран» (ТЗ 25.10.2026, п. 11); масштаб только у сетки
                  компьютера, у ленты телефона его нет, поэтому на телефоне значка нет и шапка не растёт */}
              <button
                type="button"
                className="icon-button journal-compact"
                aria-label={t('Компактный вид')}
                title={t('Компактный вид')}
                aria-pressed={compact}
                onClick={() => setCompact(!compact)}
              >
                {/* значок вне общего набора `Icon`: набор снят эталоном /design-system */}
                <FoldVertical width={20} height={20} strokeWidth={1.7} aria-hidden="true" />
              </button>
              <JournalExpandButton />
              {quickReport}
            </span>
            <Button
              disabled={
                filterPending ||
                !canCreate ||
                !day.columns.some((c) => c.id === selected) ||
                !day.services.length
              }
              title={notReady ? t('Сначала добавьте услугу и специалиста с графиком') : undefined}
              onClick={() =>
                setPanel({ kind: 'new', employeeId: selected, time: clock(day.bounds.fromMinutes) })
              }
            >
              <Icon name="plus" aria-hidden="true" />
              {t('Новая запись')}
            </Button>
          </>
        }
        summary={
          <p className="summary-line" role="group" aria-label={t('Итоги дня')}>
            <span data-testid="beauty-day-summary">
              {live.length
                ? t('Записей: {n}', { n: live.length })
                : service || status || master || query
                  ? t('По выбранным фильтрам записей не найдено')
                  : t('Записей на этот день нет')}
            </span>
            {live.length > 0 && (
              <>
                {`, ${t('ждём')} `}
                <b>
                  {live.filter((a) => a.status === 'BOOKED' || a.status === 'CONFIRMED').length}
                </b>
                {`, ${t('в работе@@запись')} `}
                <b>{live.filter((a) => a.status === 'IN_PROGRESS').length}</b>
                {`, ${t('завершено')} `}
                <b>{live.filter((a) => a.status === 'DONE').length}</b>
                {live.some((a) => a.status === 'NO_SHOW') && (
                  <>
                    {`, ${t('не пришли')} `}
                    <b>{live.filter((a) => a.status === 'NO_SHOW').length}</b>
                  </>
                )}
                {`, ${t('сумма')} `}
                <b>
                  {formatMoney(
                    String(
                      live
                        .filter((a) => a.status !== 'NO_SHOW')
                        .reduce((n, a) => n + Number(a.priceMinor), 0),
                    ),
                    live[0]!.currency,
                  )}
                </b>
              </>
            )}
          </p>
        }
        filters={
          <>
            {/* порядок как у календаря гостиницы: поиск, кто, что, статус, «Фильтры»; на телефоне выборы в «Фильтрах» */}
            <JournalSearch
              value={query}
              onChange={setQuery}
              label={t('Поиск в журнале')}
              placeholder={narrow ? t('Клиент') : t('Клиент, телефон')}
            />
            <EmployeeFilter
              options={columns}
              value={master}
              onChange={setMaster}
              allLabel={t('Все специалисты')}
              kind="specialists"
            />
            {serviceFilter}
            {statusFilter}
            {/* «Фильтры» только на телефоне (ТЗ 25.10.2026, п. 11): на компьютере все отборы уже в строке */}
            <span className="journal-head__phone-only">
              <Help
                title={<FiltersTitle active={[master, service, status].filter(Boolean).length} />}
              >
                {/* на телефоне услуга и статус переезжают сюда средствами CSS (без второй копии и без скачка разметки) */}
                {quickReportPhone}
                <StatusChips value={status} onChange={setStatus} />
              </Help>
            </span>
            <div className="journal-head__desk-only">
              <StatusChips value={status} onChange={setStatus} />
            </div>
          </>
        }
        views={views}
      />
      {(master || service || status || query) && (
        <div className="beauty-active-filters" role="status">
          <span>
            {[
              columns.find((c) => c.id === master)?.name,
              day.services.find((s) => s.id === service)?.name,
              status ? t(beautyStatus[status as keyof typeof beautyStatus]?.label ?? '') : '',
            ]
              .filter(Boolean)
              .map((label, index) => (
                <span className="beauty-selection-line" key={index}>
                  {label}
                </span>
              ))}
          </span>
          <Button
            tone="secondary"
            onClick={() => {
              setQuery('');
              applyFilters({ employee: '', service: '', status: '' });
            }}
          >
            {t('Сбросить фильтры')}
          </Button>
        </div>
      )}
      {creationUnavailableReason && <Alert>{creationUnavailableReason}</Alert>}
      {moving && <p role="status">{t('Переносим запись…')}</p>}
      {moveError && <Alert>{moveError}</Alert>}
      {notReady && (
        <EmptyState
          role="status"
          className="beauty-setup-empty"
          actions={
            <>
              {!day.services.length && (
                <Link className="btn btn--secondary" href="/services">
                  {t('Добавить услугу')}
                </Link>
              )}
              {!columns.length && (
                <Link className="btn btn--secondary" href="/employees?new=1">
                  {t('Добавить специалиста')}
                </Link>
              )}
            </>
          }
        >
          {t('Для новой записи нужны услуги и специалисты с рабочим графиком.')}
        </EmptyState>
      )}
      {/* без специалистов сетку не рисуем: пустая колонка часов ничего не говорит (п. 36) */}
      {columns.length > 0 && (
        <div className={`beauty-layout journal-screen__board${wide ? ' beauty-layout--panel' : ''}`}>
          <div className="beauty-board">
            <div
              className={`beauty-grid-day${dense ? ' beauty-grid-day--dense' : ''}`}
              data-testid="beauty-grid"
              role="region"
              aria-label={t('Расписание дня')}
              tabIndex={0}
              style={{ gridTemplateColumns: `56px repeat(${Math.max(1, shown.length)}, minmax(${shown.length > 6 ? 128 : shown.length >= 5 ? 150 : 180}px, 1fr))` }} /* slop-allow: inline-style число колонок из количества выбранных мастеров */
            >
              <div aria-hidden="true" />
              {shown.map((e) => (
                <h2 key={e.id} className="beauty-col-head">
                  {/* журнал на весь экран (владелец 20.10.2026): специалист в шапке своей колонки, без списка слева */}
                  <button
                    type="button"
                    className="beauty-col-person"
                    aria-pressed={master === e.id}
                    title={
                      master === e.id
                        ? t('{name}: показать всех специалистов', { name: e.name })
                        : t('Показать только: {name}', { name: e.name })
                    }
                    onClick={() => setMaster(master === e.id ? '' : e.id)}
                  >
                    <span className="beauty-avatar" aria-hidden="true">
                      {initials(e.name)}
                    </span>
                    <span className="beauty-col-person__name">
                      {/* 5+ мастеров: «Айгерим С.», полное имя в подсказке и для экранного диктора */}
                      {dense ? shortName(e.name) : e.name}
                    </span>
                    <span className="beauty-col-person__count" data-testid="beauty-col-count">
                      {live.filter((a) => a.employeeId === e.id).length || ''}
                    </span>
                  </button>
                  <small>
                    {e.timeOff ? (
                      <Badge>{e.timeOffReason || t('Отсутствие')}</Badge>
                    ) : e.intervals.length ? (
                      `${e.intervals.map((i) => (dense ? `${shortHour(i.timeFrom)}–${shortHour(i.timeTo)}` : `${i.timeFrom}–${i.timeTo}`)).join(', ')}${masterLoad(e, day.appointments).percent !== null ? `, ${masterLoad(e, day.appointments).percent}%` : ''}`
                    ) : (
                      t('Выходной')
                    )}
                  </small>
                  {masterLoad(e, day.appointments).percent !== null && (
                    <span
                      className="beauty-load"
                      role="img"
                      aria-label={t('Загрузка {n}%', { n: masterLoad(e, day.appointments).percent ?? 0 })}
                    >
                      <i style={{ width: `${masterLoad(e, day.appointments).percent}%` }} /* slop-allow: inline-style доля загрузки мастера */ />
                    </span>
                  )}
                </h2>
              ))}
              {hours}
              {shown.map((e) => (
                <div key={e.id}>{column(e)}</div>
              ))}
            </div>
            <div className="beauty-mobile-calendar" data-testid="beauty-mobile-calendar">
              {columns
                .filter((e) => e.id === selected)
                .map((e) => (
                  <div key={e.id}>
                    <p className="beauty-current-master">{e.name}</p>
                    <p className="beauty-note">
                      {e.timeOff
                        ? e.timeOffReason || t('Отсутствие')
                        : e.intervals.map((i) => `${i.timeFrom}–${i.timeTo}`).join(', ') ||
                          t('Выходной')}
                    </p>
                    <div className="beauty-mobile-timeline">
                      {hours}
                      {column(e)}
                    </div>
                  </div>
                ))}
            </div>
          </div>
          {wide && (
            <DayPanel
              rows={day.appointments}
              columns={columns}
              selected={day.appointments.find((r) => r.id === picked) ?? null}
              nowMinutes={nowMinutes}
              currency={day.location.currency}
              canUpdate={canUpdate}
              onOpen={(row) => setPanel({ kind: 'card', row })}
              onDone={() => router.refresh()}
            />
          )}
        </div>
      )}
      <AppointmentEditor
        canAdjustPrice={canAdjustPrice}
        open={canCreate && panel?.kind === 'new'}
        onClose={() => setPanel(null)}
        day={day}
        customers={customers}
        scopeKey={scopeKey}
        employeeId={panel?.kind === 'new' ? panel.employeeId : selected}
        time={panel?.kind === 'new' ? panel.time : clock(day.bounds.fromMinutes)}
        onDone={done}
      />
      <Overlay
        open={panel?.kind === 'card'}
        onClose={() => setPanel(null)}
        title={panel?.kind === 'card' ? t('Запись') : t('Новая запись')}
        size="lg"
        className="appointment-card-modal"
      >
        {panel?.kind === 'card' && (
          <AppointmentCard
            canAdjustPrice={canAdjustPrice}
            scopeKey={scopeKey}
            day={{ ...day, columns }}
            row={panel.row}
            canCreate={canCreate}
            canUpdate={canUpdate}
            canPay={canPay}
            canRefund={canRefund}
            canIssueReview={canIssueReview}
            onDone={done}
          />
        )}
      </Overlay>
    </>
  );
}
