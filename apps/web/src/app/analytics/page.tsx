import Link from 'next/link';
import { analyticsApi, type SiteReport, type TrackedSite } from '../../lib/api';
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
  searchParams: Promise<{ site?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
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
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 48px' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 12 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Аналитика сайта</h1>
        <span style={{ color: '#666', fontSize: 14 }} data-testid="an-site-name">
          {site.name}
        </span>
        <nav style={{ display: 'flex', gap: 10, marginLeft: 'auto', fontSize: 14 }}>
          <Link href="/analytics/setup">подключение</Link>
          <Link href="/today">сегодня</Link>
          <Link href="/journal?type=TrackedSite">журнал</Link>
        </nav>
      </header>

      <PeriodForm sites={sites} site={site} report={report} from={sp.from} to={sp.to} />

      {error && (
        <div role="alert" style={{ color: '#b91c1c', margin: '12px 0' }}>
          {error}
        </div>
      )}
      {report && <Report report={report} />}
    </main>
  );
}

function NoSites() {
  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '24px 20px 48px' }}>
      <h1 style={{ fontSize: 24 }}>Аналитика сайта</h1>
      <p>
        Счётчик ещё не подключён. Добавьте сайт и вставьте код на странице{' '}
        <Link href="/analytics/setup">подключения</Link>.
      </p>
    </main>
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
    <form
      method="get"
      style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}
    >
      {sites.length > 1 && (
        <select name="site" defaultValue={site.id} style={inp}>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}
      {sites.length === 1 && <input type="hidden" name="site" value={site.id} />}
      <input type="date" name="from" defaultValue={from ?? period?.from} style={inp} />
      <span style={{ color: '#666' }}>—</span>
      <input type="date" name="to" defaultValue={to ?? period?.to} style={inp} />
      <button type="submit" style={btn}>
        Показать
      </button>
      {period && thisMonth && prevMonth && (
        <span style={{ fontSize: 13, display: 'flex', gap: 10, marginLeft: 8 }}>
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
      <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }} data-testid="an-period">
        Период {report.period.from} — {report.period.to}, даты по {report.period.timezone}
      </div>
      <section style={cards} data-testid="an-summary">
        <Tile label="Сессии" value={String(s.sessions)} testId="an-sessions" />
        <Tile label="Уникальные посетители" value={String(s.visitors)} testId="an-visitors" />
        <Tile label="Просмотры страниц" value={String(s.pageviews)} testId="an-pageviews" />
        <Tile
          label="Страниц за сессию"
          value={s.pagesPerSession.toLocaleString('ru-RU')}
          testId="an-pages-per-session"
        />
        <Tile
          label="Среднее время сессии"
          value={duration(s.avgDurationSeconds)}
          testId="an-avg-duration"
        />
        <Tile
          label="С мобильных"
          value={pct(s.mobileShare)}
          hint={`${s.mobileSessions} из ${s.sessions}`}
          testId="an-mobile-share"
        />
        <Tile
          label="Отказы"
          value={pct(s.bounceRate)}
          hint="один просмотр и меньше 10 с"
          testId="an-bounce-rate"
        />
        <Tile
          label="Брони с сайта"
          value={String(s.bookings)}
          hint={
            s.sessions ? `${Math.round((s.bookings / s.sessions) * 1000) / 10} % сессий` : undefined
          }
          testId="an-bookings"
        />
      </section>

      <section
        style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr', margin: '16px 0' }}
      >
        <DailyChart
          rows={report.daily}
          valueKey="sessions"
          color="#2a78d6"
          label="Посещаемость сайта — сессий в день"
          testId="an-chart-sessions"
        />
        <DailyChart
          rows={report.daily}
          valueKey="mobile"
          color="#eb6834"
          label="Посещения с мобильных — сессий в день"
          testId="an-chart-mobile"
        />
      </section>
      <details style={{ marginBottom: 16 }}>
        <summary style={{ cursor: 'pointer', fontSize: 13, color: '#666' }}>
          Таблица по дням
        </summary>
        <table style={tableStyle} data-testid="an-daily-table">
          <thead>
            <tr>
              {['Дата', 'Сессии', 'Посетители', 'Просмотры', 'С мобильных'].map((h) => (
                <th key={h} style={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.daily.map((d) => (
              <tr key={d.date}>
                <td style={td}>{d.date}</td>
                <td style={tdNum}>{d.sessions}</td>
                <td style={tdNum}>{d.visitors}</td>
                <td style={tdNum}>{d.pageviews}</td>
                <td style={tdNum}>{d.mobile}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <section
        style={{ display: 'grid', gap: 12, gridTemplateColumns: '3fr 2fr', alignItems: 'start' }}
      >
        <div>
          <h2 style={h2}>Источники трафика</h2>
          <table style={tableStyle} data-testid="an-sources">
            <thead>
              <tr>
                {['Вид', 'Источник', 'Сессии', 'Посет.', 'Просм.', 'Брони', 'Время', 'Доля'].map(
                  (h) => (
                    <th key={h} style={h === 'Вид' || h === 'Источник' ? th : thNum}>
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {report.sources.length === 0 && (
                <tr>
                  <td style={td} colSpan={8}>
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
                  <td style={td}>{KIND_RU[r.kind]}</td>
                  <td style={td}>{r.source ?? '—'}</td>
                  <td style={tdNum}>{r.sessions}</td>
                  <td style={tdNum}>{r.visitors}</td>
                  <td style={tdNum}>{r.pageviews}</td>
                  <td style={tdNum} data-testid="an-source-bookings">
                    {r.bookings}
                  </td>
                  <td style={tdNum}>{duration(r.avgDurationSeconds)}</td>
                  <td style={tdNum}>
                    <Share value={r.share} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <h2 style={h2}>Страницы</h2>
            <table style={tableStyle} data-testid="an-pages">
              <thead>
                <tr>
                  <th style={th}>Путь</th>
                  <th style={thNum}>Просмотры</th>
                  <th style={thNum}>Доля</th>
                </tr>
              </thead>
              <tbody>
                {report.pages.length === 0 && (
                  <tr>
                    <td style={td} colSpan={3}>
                      Просмотров нет
                    </td>
                  </tr>
                )}
                {report.pages.map((p) => (
                  <tr key={p.path} data-testid="an-page-row" data-path={p.path}>
                    <td style={{ ...td, wordBreak: 'break-all' }}>{p.path}</td>
                    <td style={tdNum}>{p.views}</td>
                    <td style={tdNum}>
                      <Share value={p.share} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h2 style={h2}>Календарь спроса</h2>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
              На какие даты заезда посетители искали номера (событие search с сайта)
            </div>
            <table style={tableStyle} data-testid="an-demand">
              <thead>
                <tr>
                  <th style={th}>Заезд</th>
                  <th style={thNum}>Запросов</th>
                </tr>
              </thead>
              <tbody>
                {report.demand.length === 0 && (
                  <tr>
                    <td style={td} colSpan={2}>
                      Запросов нет. Форма поиска дат на сайте должна вызывать{' '}
                      <code>pms(&apos;event&apos;, &apos;search&apos;, …)</code> — см. подключение
                    </td>
                  </tr>
                )}
                {report.demand.map((d) => (
                  <tr key={d.arrival} data-testid="an-demand-row" data-arrival={d.arrival}>
                    <td style={td}>{d.arrival}</td>
                    <td style={tdNum}>{d.searches}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          alignItems: 'start',
          marginTop: 16,
        }}
      >
        <div>
          <h2 style={h2}>События с сайта</h2>
          <table style={tableStyle} data-testid="an-events">
            <thead>
              <tr>
                <th style={th}>Событие</th>
                <th style={thNum}>Раз</th>
                <th style={thNum}>Сессий</th>
              </tr>
            </thead>
            <tbody>
              {report.events.length === 0 && (
                <tr>
                  <td style={td} colSpan={3}>
                    Событий нет. Кнопки «позвонить» и WhatsApp на сайте должны вызывать{' '}
                    <code>pms(&apos;event&apos;, &apos;phone_click&apos;)</code> — см. подключение
                  </td>
                </tr>
              )}
              {report.events.map((e) => (
                <tr key={e.name} data-testid="an-event-row" data-name={e.name} data-count={e.count}>
                  <td style={td}>{EVENT_RU[e.name] ?? e.name}</td>
                  <td style={tdNum}>{e.count}</td>
                  <td style={tdNum}>{e.sessions}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
      <h2 style={h2}>{title}</h2>
      <table style={tableStyle} data-testid={testId}>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td style={td}>Сессий нет</td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.key ?? '∅'} data-key={r.key ?? ''}>
              <td style={td}>{r.key === null ? 'не определено' : (label?.(r.key) ?? r.key)}</td>
              <td style={tdNum}>{r.sessions}</td>
              <td style={tdNum}>
                <Share value={r.share} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  testId,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  testId: string;
}) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e3e5e8',
        borderRadius: 8,
        padding: '10px 12px',
      }}
    >
      <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600 }} data-testid={testId}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 11, color: '#898781' }}>{hint}</div>}
    </div>
  );
}

function Share({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}
    >
      <span
        aria-hidden
        style={{
          display: 'inline-block',
          width: 60,
          height: 6,
          borderRadius: 3,
          background: '#cde2fb',
          overflow: 'hidden',
        }}
      >
        <span
          style={{ display: 'block', width: `${pct}%`, height: '100%', background: '#2a78d6' }}
        />
      </span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pct} %</span>
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

const cards: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 12,
};
const h2: React.CSSProperties = { fontSize: 16, margin: '0 0 8px' };
const inp: React.CSSProperties = {
  padding: '6px 8px',
  border: '1px solid #cfd3d8',
  borderRadius: 6,
  fontSize: 14,
};
const btn: React.CSSProperties = {
  padding: '6px 12px',
  border: '1px solid #2a78d6',
  background: '#2a78d6',
  color: '#fff',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 14,
};
const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  background: '#fff',
  border: '1px solid #e3e5e8',
  borderRadius: 8,
  fontSize: 13,
};
const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '1px solid #e3e5e8',
  fontSize: 12,
  color: '#666',
};
const thNum: React.CSSProperties = { ...th, textAlign: 'right' };
const td: React.CSSProperties = { padding: '6px 10px', borderBottom: '1px solid #f0f1f3' };
const tdNum: React.CSSProperties = {
  ...td,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};
