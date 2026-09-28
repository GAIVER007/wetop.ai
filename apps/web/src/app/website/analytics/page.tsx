import { normalizeSearchParams, type SearchParams } from '../../../lib/search-params';
import Link from 'next/link';
import { ApiError, analyticsApi, type SiteReport, type TrackedSite } from '../../../lib/api';
import { displayDate } from '../../../lib/display-date';
import { pluralRu } from '../../../lib/plural';
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
import { DailyChart } from './daily-chart';
import { WebsiteTabs } from '../parts';
import '../../directory.css';

const MAX_PERIOD_DAYS = 366;
const periodDays = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;

const EVENT_RU: Record<string, string> = {
  search: 'поиск дат',
  phone_click: 'клик по телефону',
  whatsapp_click: 'клик по WhatsApp',
  booking_step: 'шаг бронирования',
  custom: 'другое',
};
const DEVICE_RU: Record<string, string> = {
  DESKTOP: 'компьютер',
  MOBILE: 'телефон',
  TABLET: 'планшет',
};

const KIND_RU: Record<SiteReport['sources'][number]['kind'], string> = {
  DIRECT: 'прямые заходы',
  SEARCH: 'поиск',
  SOCIAL: 'соцсети',
  PAID: 'реклама',
  EMAIL: 'рассылка',
  REFERRAL: 'переходы с сайтов',
};

/**
 * Аналитика сайта (срез 8): те же пять чисел и графики, что в «Эффективности сайта» Exely, плюс
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
    error = `Период отчёта — не больше года (${MAX_PERIOD_DAYS} дней). Выберите более короткий отрезок.`;
  else
    try {
      report = await analyticsApi.report(site.id, sp.from, sp.to);
    } catch (e) {
      // ApiError несёт текст отказа API (даты, порядок, сайт); прочее — сбой сервиса
      if (e instanceof ApiError && e.status < 500) error = `Отчёт не построен: ${e.message}`;
      else failure = e;
    }
  return (
    <Page title={WEBSITE_TITLE} subtitle={<span data-testid="an-site-name">{site.name}</span>}>
      <WebsiteTabs current="analytics" />
      {!primaryHost(site) && (
        <Notice className="block" data-testid="an-domain-missing">
          Адрес сайта не указан: счётчик не принимает посещения, отчёт останется пустым.{' '}
          <Link href="/website/settings">Добавить домен</Link>
        </Notice>
      )}
      <PeriodForm sites={sites} site={site} report={report} from={sp.from} to={sp.to} />
      {error && <Alert className="block">{error}</Alert>}
      {failure !== null && <LoadError testId="an-error" {...loadErrorProps(failure)} />}
      {report && <Report report={report} />}
    </Page>
  );
}

function NoSites() {
  return (
    <Page title={WEBSITE_TITLE}>
      <WebsiteTabs current="analytics" />
      <EmptyState
        data-testid="an-no-sites"
        title="Сайт ещё не подключён"
        actions={
          <Link href="/website/settings" className="btn">
            Подключить сайт
          </Link>
        }
      >
        Отчёт строится по событиям счётчика на сайте объекта. Подключите сайт и вставьте код
        счётчика: первые сессии появятся здесь через несколько минут после установки.
      </EmptyState>
    </Page>
  );
}

function PeriodForm({
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
  const isPreset = (f?: string, t?: string) => !!period && from === f && to === t;
  return (
    <>
      <form method="get" className="row row--lg toolbar directory-toolbar">
        {sites.length > 1 && (
          <Field inline label="Сайт">
            <Select aria-label="Сайт" name="site" defaultValue={site.id}>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {sites.length === 1 && <input type="hidden" name="site" value={site.id} />}
        <Field inline label="С">
          <DateInput
            key={`from-${from ?? ''}`}
            aria-label="Аналитика: с"
            name="from"
            defaultValue={from ?? period?.from}
          />
        </Field>
        <Field inline label="По">
          <DateInput
            key={`to-${to ?? ''}`}
            aria-label="Аналитика: по"
            name="to"
            rangeFromName="from"
            defaultValue={to ?? period?.to}
          />
        </Field>
        <Button type="submit">Показать</Button>
      </form>
      {period && prevMonth && (
        // Готовые отрезки — чипами, как на «Деньгах» и «Бронях»: период виден в адресе и в подписи ниже
        <nav className="directory-filters" aria-label="Готовые периоды">
          <Link
            href={`/website/analytics?site=${site.id}`}
            className={!from && !to ? 'is-active' : ''}
          >
            Этот месяц
          </Link>
          <Link
            href={`/website/analytics?site=${site.id}&from=${prevMonth.from}&to=${prevMonth.to}`}
            className={isPreset(prevMonth.from, prevMonth.to) ? 'is-active' : ''}
          >
            Прошлый месяц
          </Link>
          <Link
            href={`/website/analytics?site=${site.id}&from=${daysAgo(period.to, 29)}&to=${period.to}`}
            className={isPreset(daysAgo(period.to, 29), period.to) ? 'is-active' : ''}
          >
            30 дней
          </Link>
        </nav>
      )}
    </>
  );
}

function Report({ report }: { report: SiteReport }) {
  const s = report.summary;
  const pct = (x: number) => `${Math.round(x * 100)} %`;
  return (
    <>
      {/* Один <span>: `.directory-meta` — flex со `space-between` (строка «счётчик + ссылка» в «Гостях»),
          и без обёртки каждый кусок текста с <time> разъезжался в свой конец строки (21.09) */}
      <p className="directory-meta" data-testid="an-period">
        <span>
          Период{' '}
          <time dateTime={report.period.from}>{displayDate(report.period.from, 'numeric')}</time> →{' '}
          <time dateTime={report.period.to}>{displayDate(report.period.to, 'numeric')}</time>,{' '}
          {pluralRu(periodDays(report.period.from, report.period.to), ['день', 'дня', 'дней'])},
          даты по {report.period.timezone}
        </span>
      </p>
      <Stats min={230} data-testid="an-summary">
        <Stat label="Сессии" value={String(s.sessions)} testId="an-sessions" />
        <Stat label="Уникальные посетители" value={String(s.visitors)} testId="an-visitors" />
        <Stat label="Просмотры страниц" value={String(s.pageviews)} testId="an-pageviews" />
        <Stat
          label="Страниц за сессию"
          value={s.pagesPerSession.toLocaleString('ru-RU')}
          testId="an-pages-per-session"
        />
        <Stat
          label="Среднее время сессии"
          value={duration(s.avgDurationSeconds)}
          testId="an-avg-duration"
        />
        <Stat
          label="С мобильных"
          value={pct(s.mobileShare)}
          hint={`${s.mobileSessions} из ${s.sessions}`}
          testId="an-mobile-share"
        />
        <Stat
          label="Отказы"
          value={pct(s.bounceRate)}
          hint="один просмотр и меньше 10 с"
          testId="an-bounce-rate"
        />
        <Stat
          label="Брони с сайта"
          value={String(s.bookings)}
          hint={
            s.sessions ? `${Math.round((s.bookings / s.sessions) * 1000) / 10} % сессий` : undefined
          }
          testId="an-bookings"
        />
      </Stats>

      <section className="grid-2 block">
        <DailyChart
          rows={report.daily}
          valueKey="sessions"
          color="var(--chart-1)"
          label="Посещаемость сайта — сессий в день"
          testId="an-chart-sessions"
        />
        <DailyChart
          rows={report.daily}
          valueKey="mobile"
          color="var(--chart-2)"
          label="Посещения с мобильных — сессий в день"
          testId="an-chart-mobile"
        />
      </section>
      <details className="details">
        <summary>Таблица по дням</summary>
        <Table size="sm" data-testid="an-daily-table">
          <thead>
            <tr>
              {['Дата', 'Сессии', 'Посетители', 'Просмотры', 'С мобильных'].map((h) => (
                <th key={h} className={h === 'Дата' ? undefined : 'num'}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.daily.map((d) => (
              <tr key={d.date}>
                <td>
                  <time dateTime={d.date}>{displayDate(d.date)}</time>
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
          <SectionTitle first>Источники трафика</SectionTitle>
          <Table size="sm" data-testid="an-sources">
            <thead>
              <tr>
                {['Вид', 'Источник', 'Сессии', 'Посет.', 'Просм.', 'Брони', 'Время', 'Доля'].map(
                  (h) => (
                    <th key={h} className={h === 'Вид' || h === 'Источник' ? undefined : 'num'}>
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {report.sources.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-state">
                    За период сессий нет: источники появляются по визитам с сайта, как только
                    счётчик их пришлёт.
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
                  <td>{KIND_RU[r.kind]}</td>
                  <td>{r.source ?? '—'}</td>
                  <td className="num">{r.sessions}</td>
                  <td className="num">{r.visitors}</td>
                  <td className="num">{r.pageviews}</td>
                  <td className="num" data-testid="an-source-bookings">
                    {r.bookings}
                  </td>
                  <td className="num">{duration(r.avgDurationSeconds)}</td>
                  <td className="num">
                    <Share value={r.share} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        <div>
          <SectionTitle first>Страницы</SectionTitle>
          <Table size="sm" data-testid="an-pages">
            <thead>
              <tr>
                <th>Путь</th>
                <th className="num">Просмотры</th>
                <th className="num">Доля</th>
              </tr>
            </thead>
            <tbody>
              {report.pages.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty-state">
                    Просмотров за период нет: страницы появятся по первым визитам.
                  </td>
                </tr>
              )}
              {report.pages.map((p) => (
                <tr key={p.path} data-testid="an-page-row" data-path={p.path}>
                  <td className="break-all">{p.path}</td>
                  <td className="num">{p.views}</td>
                  <td className="num">
                    <Share value={p.share} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <SectionTitle>Календарь спроса</SectionTitle>
          <div className="hint block--bottom-xs">
            На какие даты заезда посетители искали номера (событие search с сайта)
          </div>
          {/* Пустое — словами для смены: инструкция для разработчика живёт на странице подключения */}
          {report.demand.length === 0 ? (
            <p className="hint" data-testid="an-demand-empty">
              Запросов нет: сайт ещё не присылает событие поиска дат. Как его включить — в{' '}
              <Link href="/website/settings">настройках сайта</Link>.
            </p>
          ) : (
            <Table size="sm" data-testid="an-demand">
              <thead>
                <tr>
                  <th>Заезд</th>
                  <th className="num">Запросов</th>
                </tr>
              </thead>
              <tbody>
                {report.demand.map((d) => (
                  <tr key={d.arrival} data-testid="an-demand-row" data-arrival={d.arrival}>
                    <td>
                      <time dateTime={d.arrival}>{displayDate(d.arrival)}</time>
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
          <SectionTitle first>События с сайта</SectionTitle>
          {report.events.length === 0 ? (
            <p className="hint" data-testid="an-events-empty">
              Событий нет: кнопки «позвонить» и WhatsApp на сайте ещё не присылают событий. Как их
              включить — в <Link href="/website/settings">настройках сайта</Link>.
            </p>
          ) : (
            <Table size="sm" data-testid="an-events">
              <thead>
                <tr>
                  <th>Событие</th>
                  <th className="num">Раз</th>
                  <th className="num">Сессий</th>
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
                    <td>{EVENT_RU[e.name] ?? e.name}</td>
                    <td className="num">{e.count}</td>
                    <td className="num">{e.sessions}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
        <ShareTable
          title="Устройства"
          rows={report.devices.devices}
          label={(k) => DEVICE_RU[k] ?? k}
          testId="an-devices"
        />
        <ShareTable title="Браузеры" rows={report.devices.browsers} testId="an-browsers" />
        <ShareTable title="Операционные системы" rows={report.devices.os} testId="an-os" />
      </Grid>
    </>
  );
}

function ShareTable({
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
  if (rows.length === 0)
    return (
      <div>
        <SectionTitle first>{title}</SectionTitle>
        <p className="hint" data-testid={`${testId}-empty`}>
          Сессий за период нет.
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
              <td>{r.key === null ? 'не определено' : (label?.(r.key) ?? r.key)}</td>
              <td className="num">{r.sessions}</td>
              <td className="num">
                <Share value={r.share} />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

function Share({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <span className="share">
      <span aria-hidden className="share__track">
        <span className="share__fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="share__pct">{pct} %</span>
    </span>
  );
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
