'use client';
import { useCallback, useEffect, useState } from 'react';
import type { AppointmentStatus, EmployeePortalDto, OrderStatus } from '@pms/domain';
import { Badge, Field, Input } from '../ui';
import { MonthInput } from '../date-field';
import { formatMoney } from '../../lib/money';
import { PortalForm, PortalScheduleRequests, PortalWeek, PortalWeekView, type PortalContext } from './forms';
import { PortalMedia } from './media';
import { PortalManagement, type PortalAccountOption } from './management';
import { EmployeeLocationsForm } from './locations';
import { EmployeeServicePrices, servicePricesKey } from './service-prices';
import { EmployeeReviews } from './reviews';
import { Tabs } from '../tabs';
import { masterSetupSteps } from './setup-steps';
import { beautyStatus } from '../../lib/status/beauty';
import { foodOrderStatus } from '../../lib/status/food';
import type { BeautyEmployeeServicePriceRow, BeautySchedule } from '../../lib/api';
import type { BeautyMasterDayStatus } from '../../lib/beauty-master-day-status';
import { EmployeeTransitionGuard } from '../employee-workspace/workspace';
import { masterNavItems } from '../../lib/master-nav';
import { portalAbsenceDays, portalAbsences, portalInitials, portalMonthLabel, portalMonthLine, portalMonthTiles, portalShiftMonth } from '../../lib/portal-month';
import { shortPeriod, zoneLabel } from '../../lib/human-period';
import { localDate } from '@pms/domain';
import { formatPhone, phoneFieldValue, phoneOnInput } from '../../lib/phone';
import { countLabel, intlLocale, msg, type Translate } from '../../i18n';
import { useLocale, useT } from '../../i18n/locale-provider';
import { dateFormat } from '../../i18n/dates';

function servicePriceLabel(service: EmployeePortalDto['services'][number], t: Translate): string {
  if (!service.available) return t('В этом филиале недоступна');
  if (service.priceType === 'FREE') return t('Бесплатно');
  if (service.priceType === 'UNFIXED') return t('Цена не задана');
  if (service.priceType === 'RANGE') {
    if (service.priceMinMinor != null && service.priceMaxMinor != null) {
      return `${formatMoney(service.priceMinMinor, service.currency)} - ${formatMoney(service.priceMaxMinor, service.currency)}`;
    }
    if (service.priceMinMinor != null) return t('от {sum}', { sum: formatMoney(service.priceMinMinor, service.currency) });
    if (service.priceMaxMinor != null) return t('до {sum}', { sum: formatMoney(service.priceMaxMinor, service.currency) });
    return t('Цена не задана');
  }
  return service.priceMinor === null ? t('Цена не задана') : formatMoney(service.priceMinor, service.currency);
}

export function EmployeeCabinet({
  initial,
  target,
  scope,
  locationAssignments,
  servicePrices,
  accountOptions,
  dayStatus,
}: {
  initial: EmployeePortalDto;
  target: { employeeId: string | null };
  scope: string;
  locationAssignments?: BeautySchedule['locations'] | null;
  servicePrices?: readonly BeautyEmployeeServicePriceRow[] | null;
  accountOptions?: PortalAccountOption[] | null;
  dayStatus?: BeautyMasterDayStatus;
}) {
  const t = useT();
  const locale = useLocale();
  const [data, setData] = useState(initial);
  const [draftEpoch, setDraftEpoch] = useState(0);
  const [invalidScope, setInvalidScope] = useState<string | null>(null);
  const registerGuard = useCallback(() => {}, []);
  const context: PortalContext = { target, scope, onSaved: setData };
  const beauty = data.business.vertical === 'BEAUTY';
  const manager = data.access === 'MANAGER';
  const access = data.sectionAccess;
  const canEditProfile = !access || (manager ? access.employeesUpdate : access.journalUpdate);
  const showWork = !beauty || !access || access.appointmentsView;
  const showReviews = beauty && (!access || access.reviewsView);
  const showServices = beauty && (!access || access.servicesView);
  const showSchedule = !beauty || !access || access.journalView;
  const showPay = !beauty || !access || access.payrollView;
  // без хранилища фото вкладку не показываем вовсе (аудит 22.10.2026: никаких «скоро подключим»)
  const showMedia = data.canUpload && (!access || canEditProfile);
  // кабинет мастера (владелец 28.10.2026): первая вкладка «Сегодня» с записями дня и цифрами месяца, как на телефоне
  const masterHome = beauty && !manager;
  const monthTiles = (() => {
      const tiles = portalMonthTiles(
        data.monthStats,
        { pay: showPay ? data.pay : null, reviews: showReviews ? data.reviews : null },
        t,
        locale,
      );
      return tiles.length ? <ul className="portal-tiles" aria-label={t('Итоги месяца')} data-testid="portal-month-tiles">
        {tiles.map((tile) => <li key={tile.id} data-tile={tile.id}><span>{tile.label}</span><strong>{tile.value}</strong>{tile.hint && <small>{tile.hint}</small>}</li>)}
      </ul> : null;
    })();
  const todaySection = beauty && !manager && data.workRange === 'DAY' && (!access || access.appointmentsView) && <section className="panel portal-section portal-today" data-testid="portal-today">
      <h2>{data.appointments.length ? t('Сегодня: {n}', { n: countLabel(locale, t, data.appointments.length, [msg('запись'), 'записи', msg('записей')]) }) /* kk-allow: форма склонения */ : t('Сегодня записей нет')}</h2>
      {data.appointments.length > 0 && <ul className="portal-today__list">{data.appointments.map((a) => <li key={a.id}>
        <b>{new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: data.location?.timezone ?? 'UTC' }).format(new Date(a.startsAt))}</b>
        <span><strong>{a.serviceName}</strong><small>{a.customerName || t('Клиент')}</small><small>{formatMoney(a.priceMinor, a.currency)}</small></span>
        <em>{t(beautyStatus[a.status as AppointmentStatus]?.label ?? msg('Неизвестный статус'))}</em>
      </li>)}</ul>}
    </section>;
  // месяц списка словом: у русского прежняя подпись, у казахского название месяца по-казахски
  const workMonth = locale === 'ru' ? portalMonthLabel(data.monthStats.month, new Date().getUTCFullYear().toString()).toLowerCase() : dateFormat(intlLocale(locale), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${data.monthStats.month}-15T12:00:00Z`));
  const showManagement = manager && (!access || access.employeesUpdate);
  useEffect(() => {
    const invalidate = () => setInvalidScope(scope);
    window.addEventListener('wetop-scope-switch', invalidate);
    return () => window.removeEventListener('wetop-scope-switch', invalidate);
  }, [scope]);
  if (invalidScope === scope) return null;
  return <EmployeeTransitionGuard
    register={registerGuard}
    discard={() => setDraftEpoch((value) => value + 1)}
  ><div key={`${scope}:${data.employee.id}:${draftEpoch}`} id="portal-top" className={!manager && beauty ? 'employee-portal employee-portal--master' : 'employee-portal'} data-testid={manager ? 'employee-manager' : beauty ? 'employee-self-master' : 'employee-self-waiter'}>
    <header className="panel portal-section portal-heading">
      {/* аудит 21.10.2026, п. 25: без бейджа «Управление сотрудником», бизнес и филиал одной строкой, если названия совпадают; «Специалист», как в разделе */}
      <div><div className="portal-identity-line">{!manager && <Badge>{t('Мой кабинет')}</Badge>}<h2>{data.employee.name}</h2></div>
        <div className="portal-identity-row"><ul className="portal-identity-meta" aria-label={t('Место работы и статус')}>{[...new Set([data.business.name, data.location?.name ?? t('Филиал не выбран')])].map((place) => <li key={place}>{place}</li>)}<li>{beauty ? t('Специалист') : t('Сотрудник ресторана')}</li><li>{data.employee.active ? t('Активен') : t('В архиве')}</li>{beauty && data.employee.active && dayStatus && <li data-testid="employee-day-status">{dayStatus.state === 'ON_SHIFT' ? (dayStatus.hours ? t('На смене, {hours}', { hours: dayStatus.hours }) : t('На смене')) : dayStatus.state === 'OFF' ? t('Выходной') : t('График недоступен')}</li>}</ul>
      {/* «Мой месяц» (срез S2, владелец 21.10.2026): одна строка итогов, без плиток; стрелки листают месяц */}
      <nav className="portal-month" aria-label={t('Итоги месяца')} data-testid="portal-month">
        <a className="btn btn--secondary btn--sm" href={`?month=${portalShiftMonth(data.monthStats.month, -1)}${data.workRange === 'MONTH' ? '&range=month' : ''}`} aria-label={t('Предыдущий месяц')} data-testid="portal-month-prev"><span aria-hidden="true">‹</span></a>
        <p className="portal-month-line" data-testid="portal-month-line" data-month={data.monthStats.month}>{portalMonthLine(data.monthStats, new Date().getUTCFullYear().toString(), t, locale)}</p>
        <a className="btn btn--secondary btn--sm" href={`?month=${portalShiftMonth(data.monthStats.month, 1)}${data.workRange === 'MONTH' ? '&range=month' : ''}`} aria-label={t('Следующий месяц')} data-testid="portal-month-next"><span aria-hidden="true">›</span></a>
      </nav></div>
      </div>
      {/* карточка, вариант A (владелец 28.10.2026): визитка, фото или инициалы, связь одним касанием */}
      <div className="portal-card-actions" data-testid="portal-card-actions">
        {manager && canEditProfile && <a className="btn btn--primary" href="#professional">{t('Редактировать')}</a>}
        {manager && data.employee.phone && <a className="btn btn--secondary" href={`tel:${data.employee.phone}`}>{t('Позвонить')}</a>}
        {manager && data.employee.phone && <a className="btn btn--secondary" href={`https://wa.me/${data.employee.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp</a>}
      </div>
      {data.avatar
        ? <img className="portal-avatar" src={data.avatar.url} alt={t('Фото: {name}', { name: data.employee.name })} width={96} height={96} />
        : <span className="portal-avatar portal-avatar--initials" aria-hidden="true" data-testid="portal-initials">{portalInitials(data.employee.name)}</span>}
    </header>
    {/* у руководителя «Сегодня» мастера нет, цифры месяца над вкладками; у мастера это первая вкладка (эскиз 1) */}
    {!masterHome && monthTiles}
    {/* новый мастер (онбординг 21.10.2026): что осталось, чтобы к нему могли записаться; ссылка открывает вкладку */}
    {beauty && manager && data.employee.active && (() => {
      const steps = masterSetupSteps({ services: data.services, week: data.week });
      return steps.length ? <nav className="panel portal-setup" aria-label={t('Чтобы к мастеру могли записаться')} data-testid="portal-setup-steps">
        <strong>{t('Чтобы к мастеру могли записаться:')}</strong>
        <ol>{steps.map((step) => <li key={step.id} data-done={step.done ? 'true' : undefined}>
          {step.done ? <span>{t('{step}: готово', { step: t(step.label) })}</span> : <a className="btn btn--secondary btn--sm" href={`#${step.tab}`}>{t(step.label)}</a>}
        </li>)}</ol>
      </nav> : null;
    })()}
    <Tabs label={t('Разделы кабинета')} className="portal-tabs" panels={[
      ...(masterHome ? [{ id: 'today', label: t('Сегодня'), content: <div className="portal-home" data-testid="portal-home">{todaySection}{monthTiles}</div> }] : []),
      { id: 'professional', label: t('Профиль'), content: <section className="panel portal-section"><h2>{t('Профессиональный профиль')}</h2>

      {canEditProfile ? <PortalForm context={context} command="profile" revision={data.profile.revision} profileRevision={data.employee.profileRevision} label={t('Сохранить профиль')}>
        <Field label={t('Имя в карточке')}><Input name="name" required maxLength={200} defaultValue={data.employee.name} /></Field>
        <Field label={t('Телефон для связи')}><Input name="phone" type="tel" inputMode="tel" maxLength={32} onInput={phoneOnInput} defaultValue={phoneFieldValue(data.employee.phone)} /></Field>
        <Field label={t('Почта для связи')}><Input name="email" type="email" maxLength={320} defaultValue={data.employee.email ?? ''} /></Field>

        <Field label={t('Специализация')}><Input name="headline" maxLength={200} defaultValue={data.profile.headline} /></Field>
        <Field label={t('О себе')}><textarea name="biography" rows={5} maxLength={5000} defaultValue={data.profile.biography} /></Field>
        <Field label={t('Год начала практики')}><Input name="practiceSinceYear" type="number" min={1900} max={new Date().getUTCFullYear()} defaultValue={data.profile.practiceSinceYear ?? ''} /></Field>
      </PortalForm> : <dl className="portal-pay-grid">
        <dt>{t('Имя в карточке')}</dt><dd>{data.employee.name}</dd>
        <dt>{t('Телефон для связи')}</dt><dd>{data.employee.phone ? formatPhone(data.employee.phone) : t('Не указан')}</dd>
        <dt>{t('Почта для связи')}</dt><dd>{data.employee.email ?? t('Не указана')}</dd>
        <dt>{t('Специализация')}</dt><dd>{data.profile.headline || t('Не указана')}</dd>
        <dt>{t('О себе')}</dt><dd>{data.profile.biography || t('Не указано')}</dd>
        <dt>{t('Год начала практики')}</dt><dd>{data.profile.practiceSinceYear ?? t('Не указан')}</dd>
      </dl>}
      <p>{t('Контакты не публикуются. Почта для входа не изменится.')}</p>
      <p>{data.profile.published ? t('Профиль виден клиентам на сайте') : t('Профиль пока не виден клиентам: его включает руководитель во вкладке «Управление»')}</p>
      {data.profile.published && <a href={`/specialists/${encodeURIComponent(data.profile.slug)}`} target="_blank" rel="noreferrer">{t('Открыть публичную страницу')}</a>}
    </section> },
      ...(showWork ? [{ id: 'work', label: beauty ? t('Записи') : t('Заказы'), content: <section className="panel portal-section" data-testid="portal-own-work"><h2>{beauty ? (manager ? t('Записи') : t('Мои записи')) : (manager ? t('Заказы') : t('Мои заказы'))}</h2>
      {/* месяц оплаты только на вкладке «Оплата труда» (аудит 21.10.2026, п. 26) */}
      {/* «День / Месяц» (D-roles п. 4): месяц тот же, что в строке итогов; не больше 200 строк по дате */}
      <nav className="portal-work-range" aria-label={t('Период списка')}>
        <a className={`btn btn--sm ${data.workRange === 'DAY' ? 'btn--primary' : 'btn--secondary'}`} href={`?month=${data.monthStats.month}#work`} aria-current={data.workRange === 'DAY' ? 'page' : undefined} data-testid="portal-work-day">{t('День')}</a>
        <a className={`btn btn--sm ${data.workRange === 'MONTH' ? 'btn--primary' : 'btn--secondary'}`} href={`?month=${data.monthStats.month}&range=month#work`} aria-current={data.workRange === 'MONTH' ? 'page' : undefined} data-testid="portal-work-month">{t('Месяц')}</a>
      </nav>
      {data.workRange === 'DAY' ? <form className="portal-filters" method="get"><Field label={beauty ? t('Дата записей') : t('Дата заказов')}><Input name="date" type="date" /></Field><button className="btn btn--secondary" type="submit">{t('Показать')}</button></form>
        : <p data-testid="portal-work-period">{beauty ? t('Записи за {month}, по дате.', { month: workMonth }) : t('Заказы за {month}, по дате.', { month: workMonth })}{data.workTruncated ? ` ${t('Показаны первые 200.')}` : ''}</p>}
      {beauty ? data.appointments.length ? <ul className="portal-list">{data.appointments.map(a => <li key={a.id}><strong>{a.serviceName}</strong><span>{shortPeriod(a.date, a.date, intlLocale(locale))}</span><span>{new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: data.location?.timezone ?? 'UTC' }).format(new Date(a.startsAt))}</span><span>{a.customerName || t('Клиент')}</span><span>{t(beautyStatus[a.status as AppointmentStatus]?.label ?? msg('Неизвестный статус'))}</span><span>{formatMoney(a.priceMinor, a.currency)}</span></li>)}</ul> : <div className="portal-work-empty"><p>{data.workRange === 'MONTH' ? t('За этот месяц записей нет') : t('На выбранную дату записей нет')}</p>{manager && data.employee.active && <a className="btn btn--secondary btn--sm" href={`/calendar?employee=${encodeURIComponent(data.employee.id)}&new=1`} data-testid="portal-work-new">{t('Новая запись')}</a>}</div>
        : data.orders.length ? <ul className="portal-list">{data.orders.map(order => <li key={order.id}><strong>{t('Заказ №{n}', { n: order.number })}</strong>{data.workRange === 'MONTH' && <span>{shortPeriod(order.date, order.date, intlLocale(locale))}</span>}<span>{order.tableName ?? t('Стол не указан')}</span><span>{t(foodOrderStatus[order.status as OrderStatus]?.label ?? msg('Неизвестный статус'))}</span><span>{formatMoney(order.totalMinor, order.currency)}</span></li>)}</ul> : <p>{t('Собственных заказов за выбранный период нет')}</p>}
    </section> }] : []),
      ...(showReviews ? [{
        id: 'reviews',
        label: t('Отзывы'),
        content: <EmployeeReviews reviews={data.reviews} timezone={data.location?.timezone ?? 'UTC'} />,
      }] : []),
      ...(showServices ? [{ id: 'services', label: t('Услуги'), content: <section className="panel portal-section" data-testid="portal-services"><h2>{manager ? t('Услуги') : t('Мои услуги')}</h2>
      <p>{manager ? t('Услуги, на которые к специалисту могут записаться.') : t('Услуги, на которые к вам могут записаться. Цены устанавливает руководитель.')}</p>
      <ul className="portal-list" data-testid="portal-assigned-services">{data.services.filter(service=>service.assigned).map(service=><li key={service.id}><strong>{service.name}</strong><span>{t('{n} мин', { n: service.durationMinutes })}</span><span>{servicePriceLabel(service, t)}</span></li>)}</ul>
      {!data.services.some(service=>service.assigned) && <p>{t('Услуги пока не выбраны')}</p>}
      {manager && (!access || access.servicesUpdate) && servicePrices !== undefined && target.employeeId && (servicePrices
        ? <EmployeeServicePrices key={servicePricesKey(servicePrices)} employeeId={target.employeeId} scope={scope} initial={servicePrices} />
        : <p role="alert">{t('Не удалось загрузить цены мастера.')}</p>)}
      {canEditProfile && (!data.location ? <p>{t('Выберите филиал, чтобы увидеть действующие цены и назначить услуги.')}</p> : <details className="portal-service-picker"><summary role="button" className="btn btn--secondary">{t('Добавить услугу')}</summary><p>{t('Отметьте услуги из каталога салона. Чтобы убрать услугу, снимите отметку.')}</p><PortalForm context={context} command="services" revision={data.servicesRevision} label={t('Сохранить услуги')}>
        {!data.services.length && <p>{t('В каталоге пока нет услуг')}</p>}
        {data.services.map(service => <label className="portal-service" key={service.id}><input type="checkbox" name="serviceIds" value={service.id} defaultChecked={service.assigned} /><span><strong>{service.name}</strong><small className="portal-service-meta"><span>{t('{n} мин', { n: service.durationMinutes })}</span><span>{servicePriceLabel(service, t)}</span></small></span></label>)}
      </PortalForm></details>)}
    </section> }] : []),
      ...(beauty && manager && (!access || access.employeesUpdate) ? [{ id: 'locations', label: t('Филиалы'), content: <section className="panel portal-section" data-testid="portal-locations"><h2>{t('Филиалы')}</h2>
      <p>{t('Выберите филиалы, в которых принимает мастер.')}</p>
      {locationAssignments && target.employeeId
        ? <EmployeeLocationsForm employeeId={target.employeeId} locations={locationAssignments} />
        : <p>{t('Назначение филиалов сейчас недоступно.')}</p>}
    </section> }] : []),
      ...(showSchedule ? [{ id: 'week', label: t('График'), content: <div className="portal-schedule"><section className="panel portal-section" data-testid="portal-week"><h2>{t('Обычная неделя')}</h2>
      {!data.location ? <p>{t('Выберите филиал для недельного графика.')}</p> : manager && (!access || access.employeesUpdate) ? <PortalWeek context={context} week={data.week} revision={data.weekRevision} /> : beauty && !manager ? <>
        {/* мастер видит свою неделю как раньше; другой график просит запросом под кнопкой (эскиз 3) */}
        <PortalWeekView week={data.week} />
        <details className="portal-request-week" data-testid="portal-request-week"><summary>{t('Попросить другой график')}</summary>
          <PortalWeek context={context} week={data.week} revision={data.weekRevision} request />
        </details>
      </> : <PortalWeekView week={data.week} />}
    </section>
    {/* график через руководителя (владелец 28.10.2026): мастер просит, руководитель подтверждает */}
    {beauty && (!manager || !access || access.employeesUpdate) && <PortalScheduleRequests requests={data.scheduleRequests ?? []} context={context} manager={manager} />}
    {/* отсутствия и выходные по датам (срез S3, владелец 21.10.2026): только просмотр, ставит руководитель */}
    <section className="panel portal-section" data-testid="portal-time-offs"><h2>{manager ? t('Отсутствия') : t('Мои отсутствия')}</h2>
      {(() => {
        const { upcoming, past } = portalAbsences(data.timeOffs, localDate(new Date(), data.location?.timezone ?? 'UTC'));
        const row = (off: EmployeePortalDto['timeOffs'][number]) => <li key={off.id} data-testid="portal-time-off"><strong>{shortPeriod(off.dateFrom, off.dateTo, intlLocale(locale))}</strong><span>{portalAbsenceDays(off, t, locale)}</span><span>{off.reason || t('Без причины')}</span></li>;
        return <>
          {upcoming.length ? <ul className="portal-list">{upcoming.map(row)}</ul> : <p>{t('Ближайших отсутствий нет.')}</p>}
          {!!past.length && <details className="portal-time-offs-past"><summary>{t('Прошедшие ({n})', { n: past.length })}</summary><ul className="portal-list">{past.map(row)}</ul></details>}
          {!manager && !beauty && <p>{t('Отсутствия и график ставит руководитель. Если нужно изменить, напишите ему.')}</p>}
        </>;
      })()}
    </section>
    {beauty && <section className="panel portal-section" data-testid="portal-schedule-conflicts" aria-live="polite"><h2>{t('Записи и график')}</h2>
      {data.scheduleConflicts.items.length ? <><p role="alert">{t('Есть записи вне графика или в дни отсутствия. Согласуйте изменения с руководителем.')}</p><ul className="portal-list">{data.scheduleConflicts.items.map(a => <li key={a.id}><strong>{a.serviceName}</strong><span>{a.locationName}</span><span>{shortPeriod(a.date, a.date, intlLocale(locale))} {new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: a.timezone }).format(new Date(a.startsAt))} ({zoneLabel(a.timezone, t)})</span><span>{a.reason === 'TIME_OFF' ? t('В день отсутствия') : t('Вне рабочих часов')}</span></li>)}</ul></> : <p>{data.scheduleConflicts.truncated ? t('Среди первых 500 записей вне нового графика нет.') : t('Записей вне нового графика нет.')}</p>}
      {data.scheduleConflicts.truncated && <p role="alert">{t('Проверены только первые 500 предстоящих записей. Проверка неполная: остальные записи нужно проверить с руководителем.')}</p>}
    </section>}
    </div> }] : []),
      ...(showPay ? [{ id: 'pay', label: manager || !beauty ? t('Оплата труда') : t('Деньги'), content: <section className="panel portal-section" data-testid="portal-pay"><div data-testid="personal-finance" data-month={data.pay.month}>
      {/* «Деньги» мастера (владелец 28.10.2026): сверху крупно, сколько осталось получить; суммы те же, что у руководителя */}
      <div className="portal-finance-top"><div><h2>{manager ? t('Оплата труда') : t('Мои финансы')}</h2><p>{t('Оплата труда за выбранный месяц')}</p></div><form className="portal-finance-period" method="get" action="#pay"><Field label={t('Месяц расчёта')}><MonthInput name="month" defaultValue={data.pay.month} required /></Field><button className="btn btn--secondary" type="submit">{t('Показать')}</button></form></div>
      <div className="portal-finance-kpis">{([
        ['finance-earned',msg('Начислено'),data.pay.status==='AVAILABLE'?data.pay.earnedMinor:null,msg('Заработок по расчёту за месяц')],
        ['finance-paid',msg('Выплачено'),data.pay.paidMinor,msg('Выплаты, учтённые руководителем')],
        ['finance-remaining',msg('Осталось к выплате'),data.pay.status==='AVAILABLE'?data.pay.remainingMinor:null,msg('Остаток по данным расчёта')],
      ] as const).map(([key,label,amount,hint])=><article key={key} data-testid={key} data-amount={amount??undefined} data-accent={!manager&&beauty&&key==='finance-remaining'?'true':undefined}><span>{t(label)}</span><strong>{amount===null?(key==='finance-paid'?t('Нет данных'):t('Нет расчёта')):formatMoney(amount,data.pay.currency)}</strong><small>{t(hint)}</small></article>)}</div>
      <p role="status" className="portal-finance-notice">{data.pay.status==='AVAILABLE'?t('Суммы те же, что видит руководитель в разделе «Зарплата».'):data.pay.status==='SELECT_LOCATION'?t('Выберите филиал в общем переключателе филиалов, чтобы увидеть начисления, выплаты и остаток за месяц.'):data.pay.status==='NOT_CONFIGURED'?t('Условия оплаты ещё не настроены. Подтверждённые выплаты отображаются отдельно.'):t('Расчёт за этот месяц недоступен. Выплаты и условия оплаты доступны ниже.')}</p>
      <div className="portal-finance-extras"><p><span>{t('Бонусы')}</span><strong>{data.pay.bonusMinor===null?t('Не указаны'):formatMoney(data.pay.bonusMinor,data.pay.currency)}</strong></p><p><span>{t('Удержания')}</span><strong>{data.pay.penaltyMinor===null?t('Не указаны'):formatMoney(data.pay.penaltyMinor,data.pay.currency)}</strong></p></div>
      <details className="portal-finance-conditions"><summary>{t('Условия оплаты')}</summary>
      <dl className="portal-pay-grid">
        <dt>{t('Модель')}</dt><dd>{data.pay.model ? t({ FIXED: msg('Фиксированная'), PERCENT: msg('Процент'), FIXED_PLUS_PERCENT: msg('Фиксированная + процент'), BONUS_ONLY: msg('Только бонусы') }[data.pay.model]) : t('Не настроена')}</dd>
        <dt>{t('Ставка')}</dt><dd>{data.pay.fixedMinor === null ? t('Не настроена') : formatMoney(data.pay.fixedMinor, data.pay.currency)}</dd>
        <dt>{t('Процент')}</dt><dd>{data.pay.percent === null ? t('Не настроен') : `${data.pay.percent}%`}</dd>
        <dt>{t('База процента')}</dt><dd>{data.pay.percentBasis === 'COMPLETED_SERVICES' ? t('Стоимость оказанных услуг') : data.pay.percentBasis === 'PAID_COMPLETED_SERVICES' ? t('Оплаченные оказанные услуги') : beauty ? t('Не настроена') : t('По закрытым заказам, расчёт сервера')}</dd>
      </dl>
      <p>{data.pay.explanation}</p></details>
      {!!data.pay.adjustments.length && <><h3>{t('Бонусы и удержания: подробности')}</h3><ul className="portal-list">{data.pay.adjustments.map(item => <li key={item.id}><strong>{item.reason}</strong><span>{formatMoney(item.amountMinor, data.pay.currency)}</span></li>)}</ul></>}
      {!manager && <p className="portal-finance-footer">{t('Условия и выплаты меняет руководитель. Здесь вы видите свои данные.')}</p>}
      </div>
    </section> }] : []),
      ...(showMedia ? [{ id: 'media', label: t('Фото и работы'), content: <PortalMedia data={data} context={context} /> }] : []),
      ...(showManagement ? [{
        id: 'management',
        label: t('Управление'),
        content: (
          <PortalManagement
            data={data}
            context={context}
            {...(accountOptions === undefined ? {} : { accountOptions })}
          />
        ),
      }] : []),
    ]} />
    {/* нижнее меню мастера на телефоне (владелец 28.10.2026); на ПК скрыто, там вкладки сверху */}
    {!manager && beauty && <nav className="portal-bottom-nav" aria-label={t('Кабинет мастера')} data-testid="master-bottom-nav">
      {masterNavItems({ showWork, showSchedule, showPay }).map((item) => <a key={item.id} href={item.href} data-nav={item.id}><span aria-hidden="true">{item.icon}</span>{t(item.label)}</a>)}
    </nav>}
  </div></EmployeeTransitionGuard>;
}
