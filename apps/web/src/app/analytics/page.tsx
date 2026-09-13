import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import Link from 'next/link';
import { analyticsApi, type SiteReport, type TrackedSite } from '../../lib/api';
import { Page } from '../../components/page';
import {
  Alert,
  Button,
  Input,
  SectionTitle,
  Select,
  Stat,
  Stats,
  Table,
} from '../../components/ui';
import { DailyChart } from './daily-chart';

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
  try {
    report = await analyticsApi.report(site.id, sp.from, sp.to);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  return (
    <Page
      title="Аналитика сайта"
      subtitle={<span data-testid="an-site-name">{site.name}</span>}
      actions={<Link href="/analytics/setup">подключение</Link>}
    >
      <PeriodForm sites={sites} site={site} report={report} from={sp.from} to={sp.to} />
      {error && <Alert className="block">{error}</Alert>}
      {report && <Report report={report} />}
    </Page>
  );
}

function NoSites() {
  return (
    <Page title="Аналитика сайта" width="medium">
      <p>
        Счётчик ещё не подключён. Добавьте сайт и вставьте код на странице{' '}
        <Link href="/analytics/setup">подключения</Link>.
      </p>
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
  const thisMonth = period ? shiftMonth(period.from, 0) : null;
  const prevMonth = period ? shiftMonth(period.from, -1) : null;
  return (
    <form method="get" className="row toolbar">
      {sites.length > 1 && (
        <Select aria-label="Сайт" name="site" defaultValue={site.id}>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      )}
      {sites.length === 1 && <input type="hidden" name="site" value={site.id} />}
      <Input
        aria-label="Аналитика: с"
        type="date"
        name="from"
        defaultValue={from ?? period?.from}
      />
      <span className="muted">—</span>
      <Input aria-label="Аналитика: по" type="date" name="to" defaultValue={to ?? period?.to} />
      <Button type="submit">Показать</Button>
      {period && thisMonth && prevMonth && (
        <span className="row row--lg hint--lg ml-sm">
          <Link href={`/analytics?site=${site.id}`}>этот месяц</Link>
          <Link href={`/analytics?site=${site.id}&from=${prevMonth.from}&to=${prevMonth.to}`}>
            прошлый месяц
          </Link>
          <Link href={`/analytics?site=${site.id}&from=${daysAgo(period.to, 29)}&to=${period.to}`}>
            30 дней до {period.to}
          </Link>
        </span>
      )}
    </form>
  );
}

function Report({ report }: { report: SiteReport }) {
  const s = report.summary;
  const pct = (x: number) => `${Math.round(x * 100)} %`;
  return (
    <>
      <div className="hint block--bottom" data-testid="an-period">
        Период {report.period.from} — {report.period.to}, даты по {report.period.timezone}
      </div>
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
                <td>{d.date}</td>
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
                  <td colSpan={8} className="muted">
                    За период сессий нет
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
                  <td colSpan={3} className="muted">
                    Просмотров нет
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
          <Table size="sm" data-testid="an-demand">
            <thead>
              <tr>
                <th>Заезд</th>
                <th className="num">Запросов</th>
              </tr>
            </thead>
            <tbody>
              {report.demand.length === 0 && (
                <tr>
                  <td colSpan={2} className="muted">
                    Запросов нет. Форма поиска дат на сайте должна вызывать{' '}
                    <code>pms(&apos;event&apos;, &apos;search&apos;, …)</code> — см. подключение
                  </td>
                </tr>
              )}
              {report.demand.map((d) => (
                <tr key={d.arrival} data-testid="an-demand-row" data-arrival={d.arrival}>
                  <td>{d.arrival}</td>
                  <td className="num">{d.searches}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </section>

      <section className="grid-auto block--top items-start">
        <div>
          <SectionTitle first>События с сайта</SectionTitle>
          <Table size="sm" data-testid="an-events">
            <thead>
              <tr>
                <th>Событие</th>
                <th className="num">Раз</th>
                <th className="num">Сессий</th>
              </tr>
            </thead>
            <tbody>
              {report.events.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted">
                    Событий нет. Кнопки «позвонить» и WhatsApp на сайте должны вызывать{' '}
                    <code>pms(&apos;event&apos;, &apos;phone_click&apos;)</code> — см. подключение
                  </td>
                </tr>
              )}
              {report.events.map((e) => (
                <tr key={e.name} data-testid="an-event-row" data-name={e.name} data-count={e.count}>
                  <td>{EVENT_RU[e.name] ?? e.name}</td>
                  <td className="num">{e.count}</td>
                  <td className="num">{e.sessions}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        <ShareTable
          title="Устройства"
          rows={report.devices.devices}
          label={(k) => DEVICE_RU[k] ?? k}
          testId="an-devices"
        />
        <ShareTable title="Браузеры" rows={report.devices.browsers} testId="an-browsers" />
        <ShareTable title="Операционные системы" rows={report.devices.os} testId="an-os" />
      </section>
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
  return (
    <div>
      <SectionTitle first>{title}</SectionTitle>
      <Table size="sm" data-testid={testId}>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td className="muted">Сессий нет</td>
            </tr>
          )}
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
