'use client';
import { useCallback, useEffect, useState } from 'react';
import type { AppointmentStatus, EmployeePortalDto, OrderStatus } from '@pms/domain';
import { Badge, Field, Input } from '../ui';
import { MonthInput } from '../date-field';
import { formatMoney } from '../../lib/money';
import { PortalForm, PortalWeek, PortalWeekView, type PortalContext } from './forms';
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
import { portalMonthLine, portalShiftMonth } from '../../lib/portal-month';

function servicePriceLabel(service: EmployeePortalDto['services'][number]): string {
  if (!service.available) return 'В этом филиале недоступна';
  if (service.priceType === 'FREE') return 'Бесплатно';
  if (service.priceType === 'UNFIXED') return 'Цена не задана';
  if (service.priceType === 'RANGE') {
    if (service.priceMinMinor != null && service.priceMaxMinor != null) {
      return `${formatMoney(service.priceMinMinor, service.currency)} - ${formatMoney(service.priceMaxMinor, service.currency)}`;
    }
    if (service.priceMinMinor != null) return `от ${formatMoney(service.priceMinMinor, service.currency)}`;
    if (service.priceMaxMinor != null) return `до ${formatMoney(service.priceMaxMinor, service.currency)}`;
    return 'Цена не задана';
  }
  return service.priceMinor === null ? 'Цена не задана' : formatMoney(service.priceMinor, service.currency);
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
  const showMedia = !access || canEditProfile;
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
  ><div key={`${scope}:${data.employee.id}:${draftEpoch}`} className="employee-portal" data-testid={manager ? 'employee-manager' : beauty ? 'employee-self-master' : 'employee-self-waiter'}>
    <header className="panel portal-section portal-heading">
      {/* аудит 21.10.2026, п. 25: без бейджа «Управление сотрудником», бизнес и филиал одной строкой, если названия совпадают; «Специалист», как в разделе */}
      <div><div className="portal-identity-line">{!manager && <Badge>Мой кабинет</Badge>}<h2>{data.employee.name}</h2></div>
        <ul className="portal-identity-meta" aria-label="Место работы и статус">{[...new Set([data.business.name, data.location?.name ?? 'Филиал не выбран'])].map((place) => <li key={place}>{place}</li>)}<li>{beauty ? 'Специалист' : 'Сотрудник ресторана'}</li><li>{data.employee.active ? 'Активен' : 'В архиве'}</li>{beauty && data.employee.active && dayStatus && <li data-testid="employee-day-status">{dayStatus.state === 'ON_SHIFT' ? `На смене${dayStatus.hours ? `, ${dayStatus.hours}` : ''}` : dayStatus.state === 'OFF' ? 'Выходной' : 'График недоступен'}</li>}</ul>
      </div>
      {data.avatar && <img className="portal-avatar" src={data.avatar.url} alt={`Фото: ${data.employee.name}`} width={96} height={96} />}
    </header>
    {/* «Мой месяц» (срез S2, владелец 21.10.2026): одна строка итогов, без плиток; стрелки листают месяц */}
    <nav className="panel portal-month" aria-label="Итоги месяца" data-testid="portal-month">
      <a className="btn btn--secondary btn--sm" href={`?month=${portalShiftMonth(data.monthStats.month, -1)}`} aria-label="Предыдущий месяц" data-testid="portal-month-prev"><span aria-hidden="true">‹</span></a>
      <p className="portal-month-line" data-testid="portal-month-line" data-month={data.monthStats.month}>{portalMonthLine(data.monthStats, new Date().getUTCFullYear().toString())}</p>
      <a className="btn btn--secondary btn--sm" href={`?month=${portalShiftMonth(data.monthStats.month, 1)}`} aria-label="Следующий месяц" data-testid="portal-month-next"><span aria-hidden="true">›</span></a>
    </nav>
    {/* новый мастер (онбординг 21.10.2026): что осталось, чтобы к нему могли записаться; ссылка открывает вкладку */}
    {beauty && manager && data.employee.active && (() => {
      const steps = masterSetupSteps({ services: data.services, week: data.week });
      return steps.length ? <nav className="panel portal-setup" aria-label="Чтобы к мастеру могли записаться" data-testid="portal-setup-steps">
        <strong>Чтобы к мастеру могли записаться:</strong>
        <ol>{steps.map((step) => <li key={step.id} data-done={step.done ? 'true' : undefined}>
          {step.done ? <span>{step.label}: готово</span> : <a className="btn btn--secondary btn--sm" href={`#${step.tab}`}>{step.label}</a>}
        </li>)}</ol>
      </nav> : null;
    })()}
    <Tabs label="Разделы кабинета" className="portal-tabs" panels={[
      { id: 'professional', label: 'Профиль', content: <section className="panel portal-section"><h2>Профессиональный профиль</h2>

      {canEditProfile ? <PortalForm context={context} command="profile" revision={data.profile.revision} profileRevision={data.employee.profileRevision} label="Сохранить профиль">
        <Field label="Имя в карточке"><Input name="name" required maxLength={200} defaultValue={data.employee.name} /></Field>
        <Field label="Телефон для связи"><Input name="phone" type="tel" maxLength={32} defaultValue={data.employee.phone ?? ''} /></Field>
        <Field label="Почта для связи"><Input name="email" type="email" maxLength={320} defaultValue={data.employee.email ?? ''} /></Field>

        <Field label="Специализация"><Input name="headline" maxLength={200} defaultValue={data.profile.headline} /></Field>
        <Field label="О себе"><textarea name="biography" rows={5} maxLength={5000} defaultValue={data.profile.biography} /></Field>
        <Field label="Год начала практики"><Input name="practiceSinceYear" type="number" min={1900} max={new Date().getUTCFullYear()} defaultValue={data.profile.practiceSinceYear ?? ''} /></Field>
      </PortalForm> : <dl className="portal-pay-grid">
        <dt>Имя в карточке</dt><dd>{data.employee.name}</dd>
        <dt>Телефон для связи</dt><dd>{data.employee.phone ?? 'Не указан'}</dd>
        <dt>Почта для связи</dt><dd>{data.employee.email ?? 'Не указана'}</dd>
        <dt>Специализация</dt><dd>{data.profile.headline || 'Не указана'}</dd>
        <dt>О себе</dt><dd>{data.profile.biography || 'Не указано'}</dd>
        <dt>Год начала практики</dt><dd>{data.profile.practiceSinceYear ?? 'Не указан'}</dd>
      </dl>}
      <p>Контакты не публикуются. Почта для входа не изменится.</p>
      <p>{data.profile.published ? 'Профиль виден клиентам на сайте' : 'Профиль пока не виден клиентам: его включает руководитель во вкладке «Управление»'}</p>
      {data.profile.published && <a href={`/specialists/${encodeURIComponent(data.profile.slug)}`} target="_blank" rel="noreferrer">Открыть публичную страницу</a>}
    </section> },
      ...(showWork ? [{ id: 'work', label: beauty ? 'Записи' : 'Заказы', content: <section className="panel portal-section" data-testid="portal-own-work"><h2>{beauty ? (manager ? 'Записи' : 'Мои записи') : (manager ? 'Заказы' : 'Мои заказы')}</h2>
      {/* месяц оплаты только на вкладке «Оплата труда» (аудит 21.10.2026, п. 26) */}
      <form className="portal-filters" method="get"><Field label="Дата записей"><Input name="date" type="date" /></Field><button className="btn btn--secondary" type="submit">Показать</button></form>
      {beauty ? data.appointments.length ? <ul className="portal-list">{data.appointments.map(a => <li key={a.id}><strong>{a.serviceName}</strong><span>{a.date}</span><span>{new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: data.location?.timezone ?? 'UTC' }).format(new Date(a.startsAt))}</span><span>{a.customerName}</span><span>{beautyStatus[a.status as AppointmentStatus]?.label ?? 'Неизвестный статус'}</span><span>{formatMoney(a.priceMinor, a.currency)}</span></li>)}</ul> : <p>На выбранную дату записей нет</p>
        : data.orders.length ? <ul className="portal-list">{data.orders.map(order => <li key={order.id}><strong>Заказ №{order.number}</strong><span>{order.tableName ?? 'Стол не указан'}</span><span>{foodOrderStatus[order.status as OrderStatus]?.label ?? 'Неизвестный статус'}</span><span>{formatMoney(order.totalMinor, order.currency)}</span></li>)}</ul> : <p>Собственных заказов за выбранный период нет</p>}
    </section> }] : []),
      ...(showReviews ? [{
        id: 'reviews',
        label: 'Отзывы',
        content: <EmployeeReviews reviews={data.reviews} timezone={data.location?.timezone ?? 'UTC'} />,
      }] : []),
      ...(showServices ? [{ id: 'services', label: 'Услуги', content: <section className="panel portal-section" data-testid="portal-services"><h2>{manager ? 'Услуги' : 'Мои услуги'}</h2>
      <p>{manager ? 'Услуги, на которые к специалисту могут записаться.' : 'Услуги, на которые к вам могут записаться. Цены устанавливает руководитель.'}</p>
      <ul className="portal-list" data-testid="portal-assigned-services">{data.services.filter(service=>service.assigned).map(service=><li key={service.id}><strong>{service.name}</strong><span>{service.durationMinutes} мин</span><span>{servicePriceLabel(service)}</span></li>)}</ul>
      {!data.services.some(service=>service.assigned) && <p>Услуги пока не выбраны</p>}
      {manager && (!access || access.servicesUpdate) && servicePrices !== undefined && target.employeeId && (servicePrices
        ? <EmployeeServicePrices key={servicePricesKey(servicePrices)} employeeId={target.employeeId} scope={scope} initial={servicePrices} />
        : <p role="alert">Не удалось загрузить цены мастера.</p>)}
      {canEditProfile && (!data.location ? <p>Выберите филиал, чтобы увидеть действующие цены и назначить услуги.</p> : <details className="portal-service-picker"><summary role="button" className="btn btn--secondary">Добавить услугу</summary><p>Отметьте услуги из каталога салона. Чтобы убрать услугу, снимите отметку.</p><PortalForm context={context} command="services" revision={data.servicesRevision} label="Сохранить услуги">
        {!data.services.length && <p>В каталоге пока нет услуг</p>}
        {data.services.map(service => <label className="portal-service" key={service.id}><input type="checkbox" name="serviceIds" value={service.id} defaultChecked={service.assigned} /><span><strong>{service.name}</strong><small className="portal-service-meta"><span>{service.durationMinutes} мин</span><span>{servicePriceLabel(service)}</span></small></span></label>)}
      </PortalForm></details>)}
    </section> }] : []),
      ...(beauty && manager && (!access || access.employeesUpdate) ? [{ id: 'locations', label: 'Филиалы', content: <section className="panel portal-section" data-testid="portal-locations"><h2>Филиалы</h2>
      <p>Выберите филиалы, в которых принимает мастер.</p>
      {locationAssignments && target.employeeId
        ? <EmployeeLocationsForm employeeId={target.employeeId} locations={locationAssignments} />
        : <p>Назначение филиалов сейчас недоступно.</p>}
    </section> }] : []),
      ...(showSchedule ? [{ id: 'week', label: 'График', content: <div className="portal-schedule"><section className="panel portal-section" data-testid="portal-week"><h2>Обычная неделя</h2>
      {!data.location ? <p>Выберите филиал для недельного графика.</p> : manager && (!access || access.employeesUpdate) ? <PortalWeek context={context} week={data.week} revision={data.weekRevision} /> : <PortalWeekView week={data.week} />}
    </section>
    {beauty && <section className="panel portal-section" data-testid="portal-schedule-conflicts" aria-live="polite"><h2>Записи и график</h2>
      <p>Проверяем предстоящие собственные записи во всех назначенных филиалах по местному времени каждого филиала. Записи не отменены и не перенесены автоматически.</p>
      {data.scheduleConflicts.items.length ? <><p role="alert">Есть записи вне графика или в дни отсутствия. Согласуйте изменения с руководителем.</p><ul className="portal-list">{data.scheduleConflicts.items.map(a => <li key={a.id}><strong>{a.serviceName}</strong><span>{a.locationName}</span><span>{a.date} {new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: a.timezone }).format(new Date(a.startsAt))} ({a.timezone})</span><span>{a.reason === 'TIME_OFF' ? 'В день отсутствия' : 'Вне рабочих часов'}</span></li>)}</ul></> : <p>{data.scheduleConflicts.truncated ? 'В проверенной части конфликтов нет.' : 'Предстоящих записей, противоречащих графику, нет.'}</p>}
      {data.scheduleConflicts.truncated && <p role="alert">Проверены только первые 500 предстоящих записей. Проверка неполная: остальные записи нужно проверить с руководителем.</p>}
    </section>}
    </div> }] : []),
      ...(showPay ? [{ id: 'pay', label: 'Оплата труда', content: <section className="panel portal-section" data-testid="portal-pay"><div data-testid="personal-finance" data-month={data.pay.month}>
      <div className="portal-finance-top"><div><h2>{manager ? 'Оплата труда' : 'Мои финансы'}</h2><p>Оплата труда за выбранный месяц</p></div><form className="portal-finance-period" method="get" action="#pay"><Field label="Месяц расчёта"><MonthInput name="month" defaultValue={data.pay.month} required /></Field><button className="btn btn--secondary" type="submit">Показать</button></form></div>
      <div className="portal-finance-kpis">{([
        ['finance-earned','Начислено',data.pay.status==='AVAILABLE'?data.pay.earnedMinor:null,'Заработок по расчёту за месяц'],
        ['finance-paid','Выплачено',data.pay.paidMinor,'Выплаты, учтённые руководителем'],
        ['finance-remaining','Осталось к выплате',data.pay.status==='AVAILABLE'?data.pay.remainingMinor:null,'Остаток по данным расчёта'],
      ] as const).map(([key,label,amount,hint])=><article key={key} data-testid={key} data-amount={amount??undefined}><span>{label}</span><strong>{amount===null?(key==='finance-paid'?'Нет данных':'Нет расчёта'):formatMoney(amount,data.pay.currency)}</strong><small>{hint}</small></article>)}</div>
      <p role="status" className="portal-finance-notice">{data.pay.status==='AVAILABLE'?'Суммы те же, что видит руководитель в разделе «Зарплата».':data.pay.status==='SELECT_LOCATION'?'Выберите филиал в общем переключателе филиалов, чтобы увидеть начисления, выплаты и остаток за месяц.':data.pay.status==='NOT_CONFIGURED'?'Условия оплаты ещё не настроены. Подтверждённые выплаты отображаются отдельно.':'Расчёт за этот месяц недоступен. Выплаты и условия оплаты доступны ниже.'}</p>
      <div className="portal-finance-extras"><p><span>Бонусы</span><strong>{data.pay.bonusMinor===null?'Не указаны':formatMoney(data.pay.bonusMinor,data.pay.currency)}</strong></p><p><span>Удержания</span><strong>{data.pay.penaltyMinor===null?'Не указаны':formatMoney(data.pay.penaltyMinor,data.pay.currency)}</strong></p></div>
      <details className="portal-finance-conditions"><summary>Условия оплаты</summary>
      <dl className="portal-pay-grid">
        <dt>Модель</dt><dd>{data.pay.model ? ({ FIXED: 'Фиксированная', PERCENT: 'Процент', FIXED_PLUS_PERCENT: 'Фиксированная + процент', BONUS_ONLY: 'Только бонусы' }[data.pay.model]) : 'Не настроена'}</dd>
        <dt>Ставка</dt><dd>{data.pay.fixedMinor === null ? 'Не настроена' : formatMoney(data.pay.fixedMinor, data.pay.currency)}</dd>
        <dt>Процент</dt><dd>{data.pay.percent === null ? 'Не настроен' : `${data.pay.percent}%`}</dd>
        <dt>База процента</dt><dd>{data.pay.percentBasis === 'COMPLETED_SERVICES' ? 'Стоимость оказанных услуг' : data.pay.percentBasis === 'PAID_COMPLETED_SERVICES' ? 'Оплаченные оказанные услуги' : beauty ? 'Не настроена' : 'По закрытым заказам, расчёт сервера'}</dd>
      </dl>
      <p>{data.pay.explanation}</p></details>
      {!!data.pay.adjustments.length && <><h3>Бонусы и удержания: подробности</h3><ul className="portal-list">{data.pay.adjustments.map(item => <li key={item.id}><strong>{item.reason}</strong><span>{formatMoney(item.amountMinor, data.pay.currency)}</span></li>)}</ul></>}
      {!manager && <p className="portal-finance-footer">Условия и выплаты меняет руководитель. Здесь вы видите свои данные.</p>}
      </div>
    </section> }] : []),
      ...(showMedia ? [{ id: 'media', label: 'Фото и работы', content: <PortalMedia data={data} context={context} /> }] : []),
      ...(showManagement ? [{
        id: 'management',
        label: 'Управление',
        content: (
          <PortalManagement
            data={data}
            context={context}
            {...(accountOptions === undefined ? {} : { accountOptions })}
          />
        ),
      }] : []),
    ]} />
  </div></EmployeeTransitionGuard>;
}
