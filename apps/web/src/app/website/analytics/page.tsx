import { requireFeature } from '../../../lib/vertical-guard';
import { normalizeSearchParams, type SearchParams } from '../../../lib/search-params';
import Link from 'next/link';
import { ApiError, analyticsApi, type SiteReport, type TrackedSite } from '../../../lib/api';
import { displayDate } from '../../../lib/display-date';
import { formatMoney } from '../../../lib/money';
import { countLabel, intlLocale, msg } from '../../../i18n';
import { currentLocale, serverT } from '../../../i18n/server';
import { WEBSITE_TITLE, primaryHost } from '../../../lib/website';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { loadErrorProps } from '../../../lib/load-error';
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Grid,
  Notice,
  SectionTitle,
  Select,
  Stat,
  Stats,
  Table,
} from '../../../components/ui';
import { DateInput } from '../../../components/date-field';
import { ShareBar } from '../../../components/share-bar';
import { DailyChart } from './daily-chart';
import { MarketingCrumb, WebsiteTabs } from '../parts';
import '../../directory.css';
import '../website.css';

const MAX_PERIOD_DAYS = 366;
const periodDays = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;

const EVENT_RU: Record<string, string> = {
  search: msg('поиск дат'),
  phone_click: msg('клик по телефону'),
  whatsapp_click: msg('клик по WhatsApp'),
  booking_step: msg('шаг бронирования'),
  custom: msg('другое'),
};
const DEVICE_RU: Record<string, string> = {
  DESKTOP: msg('компьютер'),
  MOBILE: msg('телефон'),
  TABLET: msg('планшет'),
};

const KIND_RU: Record<SiteReport['sources'][number]['kind'], string> = {
  DIRECT: msg('прямые заходы'),
  SEARCH: msg('поиск'),
  SOCIAL: msg('соцсети'),
  PAID: msg('реклама'),
  EMAIL: msg('рассылка'),
  REFERRAL: msg('переходы с сайтов'),
};

/**
 * Аналитика сайта (срез 8): пять основных чисел и графики, плюс
 * отказы, страницы и календарь спроса. Период — по датам объекта (Asia/Almaty), по умолчанию текущий месяц.
 * D4 (план владельца 19.09): без счётчика — `EmptyState` с шагом; отказ сервиса аналитики — `LoadError` с
 * повтором (отклонённый запрос по-прежнему словами у формы); период словами в `<time>`, готовые отрезки чипами,
 * пустые таблицы объясняют, откуда возьмутся строки. Расчёт отчёта в API не менялся.
 * С 27.09 (ADR-117) — вкладка «Аналитика» модуля «Сайт и онлайн-бронирование»; прежний `/analytics` ведёт сюда.
 */
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // сайт и онлайн-бронь гостиницы; у салона и ресторана сайт в «Продвижении» (аудит 17.10.2026, Д11)
  await requireFeature('/website/analytics');
  const t = await serverT();
  const sp = normalizeSearchParams(await searchParams);
  const sites = await analyticsApi.sites();
  if (!sites.length) return <NoSites />;
  const site = sites.find((s) => s.id === sp.site) ?? sites[0];
  if (!site) return <NoSites />;
  let report: SiteReport | null = null;
  let error: string | null = null;
  // Сервис аналитики не ответил (5xx или обрыв): не строка совета, а сбой с повтором — экран остаётся (D4)
  let failure: unknown = null;
  if (sp.from && sp.to && periodDays(sp.from, sp.to) > MAX_PERIOD_DAYS)
    // Предел периода — в стойке: отчёт по дням за несколько лет никому не нужен и долго считается
    error = t('Период отчёта — не больше года ({n} дней). Выберите более короткий отрезок.', { n: MAX_PERIOD_DAYS });
  else
    try {
      report = await analyticsApi.report(site.id, sp.from, sp.to);
    } catch (e) {
      // ApiError несёт текст отказа API (даты, порядок, сайт); прочее — сбой сервиса
      if (e instanceof ApiError && e.status < 500) error = t('Отчёт не построен: {reason}', { reason: e.message });
      else failure = e;
    }
  return (
    <Page
      crumbs={<MarketingCrumb />}
      title={t(WEBSITE_TITLE)}
      subtitle={<span data-testid="an-site-name">{site.name}</span>}
    >
      <WebsiteTabs current="analytics" />
      {!primaryHost(site) && (
        <Notice className="block" data-testid="an-domain-missing">
          {t('Адрес сайта не указан: счётчик не принимает посещения, отчёт останется пустым.')}{' '}
          <Link href="/website/settings">{t('Добавить домен')}</Link>
        </Notice>
      )}
      <PeriodForm sites={sites} site={site} report={report} from={sp.from} to={sp.to} />
      {error && <Alert className="block">{error}</Alert>}
      {failure !== null && <LoadError testId="an-error" {...loadErrorProps(failure)} />}
      {report && <Report report={report} />}
    </Page>
  );
}

async function NoSites() {
  const t = await serverT();
  return (
    <Page crumbs={<MarketingCrumb />} title={t(WEBSITE_TITLE)}>
      <WebsiteTabs current="analytics" />
      <EmptyState
        data-testid="an-no-sites"
        title={t('Сайт ещё не подключён')}
        actions={
          <Link href="/website/settings" className="btn">
            {t('Подключить сайт')}
          </Link>
        }
      >
        {t('Отчёт строится по событиям счётчика на сайте объекта. Подключите сайт и вставьте код счётчика: первые сессии появятся здесь через несколько минут после установки.')}
      </EmptyState>
    </Page>
  );
}

async function PeriodForm({
  sites,
  site,
  report,
  from,
  to,
}: {
  sites: TrackedSite[];
  site: TrackedSite;
  report: SiteReport | null;
  from?: string | undefined;
  to?: string | undefined;
}) {
  const period = report?.period;
  const prevMonth = period ? shiftMonth(period.from, -1) : null;
  const t = await serverT();
  const isPreset = (f?: string, till?: string) => !!period && from === f && to === till;
  return (
    <>
      <form method="get" className="row row--lg toolbar directory-toolbar">
        {sites.length > 1 && (
          <Field inline label={t('Сайт')}>
            <Select aria-label={t('Сайт')} name="site" defaultValue={site.id}>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {sites.length === 1 && <input type="hidden" name="site" value={site.id} />}
        <Field inline label={t('С')}>
          <DateInput
            key={`from-${from ?? ''}`}
            aria-label={t('Аналитика: с')}
            name="from"
            defaultValue={from ?? period?.from}
          />
        </Field>
        <Field inline label={t('По')}>
          <DateInput
            key={`to-${to ?? ''}`}
            aria-label={t('Аналитика: по')}
            name="to"
            rangeFromName="from"
            defaultValue={to ?? period?.to}
          />
        </Field>
        <Button type="submit">{t('Показать')}</Button>
      </form>
      {period && prevMonth && (
        // Готовые отрезки — чипами, как на «Деньгах» и «Бронях»: период виден в адресе и в подписи ниже
        <nav className="directory-filters" aria-label={t('Готовые периоды')}>
          <Link
            href={`/website/analytics?site=${site.id}`}
            className={!from && !to ? 'is-active' : ''}
          >
            {t('Этот месяц')}
          </Link>
          <Link
            href={`/website/analytics?site=${site.id}&from=${prevMonth.from}&to=${prevMonth.to}`}
            className={isPreset(prevMonth.from, prevMonth.to) ? 'is-active' : ''}
          >
            {t('Прошлый месяц')}
          </Link>
          <Link
            href={`/website/analytics?site=${site.id}&from=${daysAgo(period.to, 29)}&to=${period.to}`}
            className={isPreset(daysAgo(period.to, 29), period.to) ? 'is-active' : ''}
          >
            {t('30 дней')}
          </Link>
        </nav>
      )}
    </>
  );
}

async function Report({ report }: { report: SiteReport }) {
  const t = await serverT();
  const locale = await currentLocale();
  const days = periodDays(report.period.from, report.period.to);
  const daysText = countLabel(locale, t, days, [msg('день'), 'дня', msg('дней')]); // kk-allow: форма склонения
  const s = report.summary;
  const pct = (x: number) => `${Math.round(x * 100)} %`;
  return (
    <>
      {/* Один <span>: `.directory-meta` — flex со `space-between` (строка «счётчик + ссылка» в «Гостях»),
          и без обёртки каждый кусок текста с <time> разъезжался в свой конец строки (21.09) */}
      <p className="directory-meta" data-testid="an-period">
        <span>
          {t('Период')}{' '}
          <time dateTime={report.period.from}>{displayDate(report.period.from, 'numeric')}</time> →{' '}
          <time dateTime={report.period.to}>{displayDate(report.period.to, 'numeric')}</time>,{' '}
          {daysText}, {t('даты по {timezone}', { timezone: report.period.timezone })}
        </span>
      </p>
      <section className="grid-2 block">
        <SiteBookings report={report} />
        <FunnelBlock funnel={report.funnel} />
      </section>
      <Stats min={230} data-testid="an-summary">
        <Stat label={t('Сессии')} value={String(s.sessions)} testId="an-sessions" />
        <Stat label={t('Уникальные посетители')} value={String(s.visitors)} testId="an-visitors" />
        <Stat label={t('Просмотры страниц')} value={String(s.pageviews)} testId="an-pageviews" />
        <Stat
          label={t('Страниц за сессию')}
          value={s.pagesPerSession.toLocaleString('ru-RU')}
          testId="an-pages-per-session"
        />
        <Stat
          label={t('Среднее время сессии')}
          value={duration(s.avgDurationSeconds)}
          testId="an-avg-duration"
        />
        <Stat
          label={t('С мобильных')}
          value={pct(s.mobileShare)}
          hint={t('{n} из {total}', { n: s.mobileSessions, total: s.sessions })}
          testId="an-mobile-share"
        />
        <Stat
          label={t('Отказы')}
          value={pct(s.bounceRate)}
          hint={t('один просмотр и меньше 10 с')}
          testId="an-bounce-rate"
        />
        {/* WEB4: брони с сайта — отдельный блок выше; здесь только сессии счётчика, дошедшие до брони */}
        <Stat
          label={t('Сессий с бронью')}
          value={String(s.bookings)}
          hint={
            s.sessions
              ? t('{pct} % сессий', { pct: (Math.round((s.bookings / s.sessions) * 1000) / 10).toLocaleString('ru-RU') })
              : undefined
          }
          testId="an-bookings"
        />
      </Stats>

      <section className="grid-2 block">
        <DailyChart
          rows={report.daily}
          valueKey="sessions"
          color="var(--chart-1)"
          label={t('Посещаемость сайта — сессий в день')}
          testId="an-chart-sessions"
        />
        <DailyChart
          rows={report.daily}
          valueKey="mobile"
          color="var(--chart-2)"
          label={t('Посещения с мобильных — сессий в день')}
          testId="an-chart-mobile"
        />
      </section>
      <details className="details">
        <summary>{t('Таблица по дням')}</summary>
        <Table size="sm" data-testid="an-daily-table">
          <thead>
            <tr>
              {[msg('Дата'), msg('Сессии'), msg('Посетители'), msg('Просмотры'), msg('С мобильных')].map((h, i) => (
                <th key={h} className={i === 0 ? undefined : 'num'}>
                  {t(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.daily.map((d) => (
              <tr key={d.date}>
                <td>
                  <time dateTime={d.date}>{displayDate(d.date, 'short', intlLocale(locale))}</time>
                </td>
                <td className="num">{d.sessions}</td>
                <td className="num">{d.visitors}</td>
                <td className="num">{d.pageviews}</td>
                <td className="num">{d.mobile}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </details>

      <section className="split split--3-2">
        <div>
          <SectionTitle first>{t('Источники трафика')}</SectionTitle>
          <Table size="sm" data-testid="an-sources">
            <thead>
              <tr>
                {[msg('Вид'), msg('Источник'), msg('Сессии'), msg('Посет.'), msg('Просм.'), msg('Брони'), msg('Время'), msg('Доля')].map(
                  (h, i) => (
                    <th key={h} className={i < 2 ? undefined : 'num'}>
                      {t(h)}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {report.sources.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-state">
                    {t('За период сессий нет: источники появляются по визитам с сайта, как только счётчик их пришлёт.')}
                  </td>
                </tr>
              )}
              {report.sources.map((r) => (
                <tr
                  key={`${r.kind}-${r.source ?? ''}`}
                  data-testid="an-source-row"
                  data-kind={r.kind}
                  data-source={r.source ?? ''}
                  data-sessions={r.sessions}
                >
                  <td>{t(KIND_RU[r.kind])}</td>
                  <td>{r.source ?? '—'}</td>
                  <td className="num">{r.sessions}</td>
                  <td className="num">{r.visitors}</td>
                  <td className="num">{r.pageviews}</td>
                  <td className="num" data-testid="an-source-bookings">
                    {r.bookings}
                  </td>
                  <td className="num">{duration(r.avgDurationSeconds)}</td>
                  <td className="num">
                    <Share value={r.share} of={r.source ?? t(KIND_RU[r.kind])} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        <div>
          <SectionTitle first>{t('Страницы')}</SectionTitle>
          <Table size="sm" data-testid="an-pages">
            <thead>
              <tr>
                <th>{t('Путь')}</th>
                <th className="num">{t('Просмотры')}</th>
                <th className="num">{t('Доля')}</th>
              </tr>
            </thead>
            <tbody>
              {report.pages.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty-state">
                    {t('Просмотров за период нет: страницы появятся по первым визитам.')}
                  </td>
                </tr>
              )}
              {report.pages.map((p) => (
                <tr key={p.path} data-testid="an-page-row" data-path={p.path}>
                  <td className="break-all">{p.path}</td>
                  <td className="num">{p.views}</td>
                  <td className="num">
                    <Share value={p.share} of={p.path} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <SectionTitle>{t('Календарь спроса')}</SectionTitle>
          <div className="hint block--bottom-xs">
            {t('На какие даты заезда посетители искали номера (событие search с сайта)')}
          </div>
          {/* Пустое — словами для смены: инструкция для разработчика живёт на странице подключения */}
          {report.demand.length === 0 ? (
            <p className="hint" data-testid="an-demand-empty">
              {t('Запросов нет: сайт ещё не присылает событие поиска дат. Как его включить — в')}{' '}
              <Link href="/website/settings">{t('настройках сайта')}</Link>.
            </p>
          ) : (
            <Table size="sm" data-testid="an-demand">
              <thead>
                <tr>
                  <th>{t('Заезд')}</th>
                  <th className="num">{t('Запросов')}</th>
                </tr>
              </thead>
              <tbody>
                {report.demand.map((d) => (
                  <tr key={d.arrival} data-testid="an-demand-row" data-arrival={d.arrival}>
                    <td>
                      <time dateTime={d.arrival}>{displayDate(d.arrival, 'short', intlLocale(locale))}</time>
                    </td>
                    <td className="num">{d.searches}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </section>

      {/* Четыре таблицы в четыре колонки по ~270 px обрезались («Сессий за пер»): две колонки (21.09) */}
      <Grid min={480} className="block--top items-start">
        <div>
          <SectionTitle first>{t('События с сайта')}</SectionTitle>
          {report.events.length === 0 ? (
            <p className="hint" data-testid="an-events-empty">
              {t('Событий нет: кнопки «позвонить» и WhatsApp на сайте ещё не присылают событий. Как их включить — в')}{' '}
              <Link href="/website/settings">{t('настройках сайта')}</Link>.
            </p>
          ) : (
            <Table size="sm" data-testid="an-events">
              <thead>
                <tr>
                  <th>{t('Событие')}</th>
                  <th className="num">{t('Раз')}</th>
                  <th className="num">{t('Сессий')}</th>
                </tr>
              </thead>
              <tbody>
                {report.events.map((e) => (
                  <tr
                    key={e.name}
                    data-testid="an-event-row"
                    data-name={e.name}
                    data-count={e.count}
                  >
                    <td>{EVENT_RU[e.name] ? t(EVENT_RU[e.name]!) : e.name}</td>
                    <td className="num">{e.count}</td>
                    <td className="num">{e.sessions}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
        <ShareTable
          title={t('Устройства')}
          rows={report.devices.devices}
          label={(k) => (DEVICE_RU[k] ? t(DEVICE_RU[k]!) : k)}
          testId="an-devices"
        />
        <ShareTable title={t('Браузеры')} rows={report.devices.browsers} testId="an-browsers" />
        <ShareTable title={t('Операционные системы')} rows={report.devices.os} testId="an-os" />
      </Grid>
    </>
  );
}

/**
 * Брони с сайта (WEB4, Q-212): брони объекта с источником «Сайт», созданные за период, — все, а не только из сессий
 * со счётчиком; начислено — по их счетам, как колонка «Финансы» в «Бронях». Ссылка ведёт туда с тем же отбором.
 */
async function SiteBookings({ report }: { report: SiteReport }) {
  const t = await serverT();
  const r = report.siteReservations;
  const href = `/reservations?${new URLSearchParams({
    from: report.period.from,
    to: report.period.to,
    date: 'created',
    source: 'WEBSITE',
  })}`;
  const lost = [
    r.cancelled ? t('отменено {n}', { n: r.cancelled }) : null,
    r.noShow ? t('не заехали {n}', { n: r.noShow }) : null,
  ].filter(Boolean);
  return (
    <div data-testid="an-site-reservations">
      <SectionTitle first>{t('Брони с сайта')}</SectionTitle>
      <Stats min={180}>
        {/* Q-209 (правило владельца): одна Reservation — одна бронь; «Новые брони» — по дате создания */}
        <Stat
          label={t('Новые брони')}
          value={String(r.count)}
          hint={lost.length ? t('из них {list}', { list: lost.join(', ') }) : undefined}
          testId="an-site-reservations-count"
        />
        <Stat
          label={t('Начислено')}
          value={
            r.charged.length
              ? // валют бывает больше одной — каждая своей строкой (DESIGN.md §14: без точки-разделителя)
                r.charged.map((c) => (
                  <div key={c.currency}>{formatMoney(c.chargedMinor, c.currency)}</div>
                ))
              : '—'
          }
          hint={t('по счетам этих броней')}
          testId="an-site-reservations-charged"
        />
      </Stats>
      <p className="hint block--top">
        {t('Брони с источником «Сайт», созданные за период, — с виджета и без счётчика тоже. У брони нет номера сайта, поэтому это брони всего объекта.')}
      </p>
      {r.count > 0 && (
        <p className="block--top">
          <Link href={href}>{t('Открыть в «Бронях»')}</Link>
        </p>
      )}
    </div>
  );
}

/**
 * Воронка сайта (WEB4): сессии периода, дошедшие до шага. Порядка событий база не хранит, но виджет ведёт гостя
 * строго по шагам — сессия, дошедшая дальше, засчитана и на шагах до этого (`bookingFunnel` домена).
 */
async function FunnelBlock({ funnel }: { funnel: SiteReport['funnel'] }) {
  const t = await serverT();
  const steps = [
    { label: msg('Посещения'), value: funnel.visits, of: null },
    {
      label: msg('Поиск дат'),
      value: funnel.searches,
      of: { value: funnel.visits, word: msg('от посещений') },
    },
    {
      label: msg('Начали бронь'),
      value: funnel.started,
      of: { value: funnel.searches, word: msg('от поиска') },
    },
    { label: msg('Бронь'), value: funnel.booked, of: { value: funnel.started, word: msg('от начатых') } },
  ];
  const conversion = `${(Math.round(funnel.conversion * 1000) / 10).toLocaleString('ru-RU')} %`;
  return (
    <div className="an-funnel" data-testid="an-funnel">
      <SectionTitle first>{t('Воронка')}</SectionTitle>
      <Table size="sm" plain>
        <thead>
          <tr>
            <th>{t('Шаг')}</th>
            <th className="num">{t('Сессий')}</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((step) => (
            <tr key={step.label} data-testid="an-funnel-step">
              {/* переход — второй строкой под шагом: колонки перехода и доли на телефоне уезжали за край */}
              <td>
                {t(step.label)}
                {step.of && (
                  <div className="hint">
                    {step.of.value
                      ? `${Math.round((step.value / step.of.value) * 100)} % ${t(step.of.word)}`
                      : '—'}
                  </div>
                )}
              </td>
              <td className="num">{step.value}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="block--top">
        {t('Конверсия в бронь')} <strong data-testid="an-funnel-conversion">{conversion}</strong>
      </p>
      <p className="hint">
        {t('Сессии со счётчиком WETOP: поиск и шаги брони шлёт виджет. Брони без счётчика есть только в «Бронях с сайта».')}
      </p>
    </div>
  );
}

async function ShareTable({
  title,
  rows,
  label,
  testId,
}: {
  title: string;
  rows: Array<{ key: string | null; sessions: number; share: number }>;
  label?: (key: string) => string;
  testId: string;
}) {
  const t = await serverT();
  if (rows.length === 0)
    return (
      <div>
        <SectionTitle first>{title}</SectionTitle>
        <p className="hint" data-testid={`${testId}-empty`}>
          {t('Сессий за период нет.')}
        </p>
      </div>
    );
  return (
    <div>
      <SectionTitle first>{title}</SectionTitle>
      <Table size="sm" data-testid={testId}>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key ?? '∅'} data-key={r.key ?? ''}>
              <td>{r.key === null ? t('не определено') : (label?.(r.key) ?? r.key)}</td>
              <td className="num">{r.sessions}</td>
              <td className="num">
                <Share
                  value={r.share}
                  of={r.key === null ? t('не определено') : (label?.(r.key) ?? r.key)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

/** Доля строки: общий `ShareBar` (MV8.5 DS1c) вместо своей полосы с шириной строкой стиля */
async function Share({ value, of }: { value: number; of: string }) {
  const t = await serverT();
  return <ShareBar label={t('Доля: {of}', { of })} value={Math.round(value * 100)} max={100} showValue />;
}

function duration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
function shiftMonth(date: string, delta: number): { from: string; to: string } {
  const [y = 0, m = 1] = date.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const ym = d.toISOString().slice(0, 7);
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` };
}
function daysAgo(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
}
