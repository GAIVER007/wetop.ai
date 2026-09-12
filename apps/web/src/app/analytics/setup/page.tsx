import Link from 'next/link';
import { analyticsApi, reservationsApi, type TrackedSiteCard } from '../../../lib/api';
import { BookingSettings, CopyButton, CreateSiteForm, SiteButtons } from './forms';

/** Подключение счётчика: сайты, код для вставки, статус. Постоянный публичный адрес API — Q-112. */
export default async function AnalyticsSetupPage() {
  const sites = await analyticsApi.sites();
  const cards = await Promise.all(sites.map((s) => analyticsApi.card(s.id)));
  const plans = await reservationsApi.ratePlans().catch(() => []);
  const scriptUrl = cards[0]?.snippet.scriptUrl ?? null;
  const localOnly = !scriptUrl || /127\.0\.0\.1|localhost/.test(scriptUrl);
  const insecure = !!scriptUrl && !localOnly && !scriptUrl.startsWith('https://');
  return (
    <main style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 20px 48px' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 12 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Подключение счётчика</h1>
        <nav style={{ display: 'flex', gap: 10, marginLeft: 'auto', fontSize: 14 }}>
          <Link href="/analytics">отчёт</Link>
          <Link href="/today">сегодня</Link>
        </nav>
      </header>

      {cards.length > 0 && localOnly && (
        <div
          role="alert"
          data-testid="setup-local-warning"
          style={{
            background: '#fff7ed',
            border: '1px solid #fdba74',
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          Код ниже указывает на локальный адрес API ({scriptUrl}). Для настоящего сайта нужен
          постоянный публичный адрес (PUBLIC_API_URL в .env, вопрос Q-112): адрес быстрого туннеля
          меняется при каждом перезапуске, и код на сайте перестанет работать.
        </div>
      )}

      {cards.length > 0 && insecure && (
        <div
          role="alert"
          data-testid="setup-insecure-warning"
          style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          Адрес API без https ({scriptUrl}). Сайт на https молча не загрузит такой скрипт (смешанный
          контент). PUBLIC_API_URL должен начинаться с https://.
        </div>
      )}

      {cards.map((c) => (
        <SiteCard key={c.site.id} card={c} plans={plans} />
      ))}

      <section style={box}>
        <h2 style={h2}>{cards.length ? 'Ещё один сайт' : 'Добавить сайт'}</h2>
        <CreateSiteForm />
      </section>

      <section style={box}>
        <h2 style={h2}>Как это работает</h2>
        <ol style={{ fontSize: 14, lineHeight: 1.6, paddingLeft: 20, margin: 0 }}>
          <li>
            Вставьте код счётчика в &lt;head&gt; каждой страницы сайта (в Tilda и WordPress — поле
            «HTML-код в head»).
          </li>
          <li>
            Счётчик шлёт только: адрес и заголовок страницы, реферер, ширину экрана, язык, часовой
            пояс и случайные ID посетителя и сессии. Без cookies, без IP, без имён и телефонов.
          </li>
          <li>
            Если на сайте есть форма поиска дат, вызовите при поиске{' '}
            <code>
              pms(&apos;event&apos;, &apos;search&apos;, {'{'}arrival: &apos;2026-10-01&apos;,
              departure: &apos;2026-10-03&apos;, adults: 2{'}'})
            </code>{' '}
            — так заполняется календарь спроса. Клики по телефону и WhatsApp:{' '}
            <code>pms(&apos;event&apos;, &apos;phone_click&apos;)</code>,{' '}
            <code>pms(&apos;event&apos;, &apos;whatsapp_click&apos;)</code>.
          </li>
          <li>
            Нужен баннер согласия — добавьте атрибут <code>data-consent=&quot;wait&quot;</code> и
            вызовите <code>pms(&apos;consent&apos;)</code> после согласия.
          </li>
          <li>
            Нажмите «Проверить счётчик» после первого захода на сайт — здесь появится время
            последнего события. Проверить без сайта: откройте «демо-страницу» с телефона и нажмите
            кнопки на ней.
          </li>
        </ol>
      </section>
    </main>
  );
}

function SiteCard({
  card,
  plans,
}: {
  card: TrackedSiteCard;
  plans: Array<{ code: string; name: string }>;
}) {
  const { site, status, snippet } = card;
  return (
    <section style={box} data-testid="site-card" data-key={site.publicKey}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <h2 style={{ ...h2, margin: 0 }} data-testid="site-card-name">
          {site.name}
        </h2>
        <span style={{ fontSize: 13, color: '#666' }}>{site.hosts.join(', ')}</span>
        <span
          data-testid="site-card-status"
          style={{
            fontSize: 12,
            padding: '2px 8px',
            borderRadius: 999,
            background: site.status === 'ACTIVE' ? '#dcfce7' : '#f3f4f6',
            color: site.status === 'ACTIVE' ? '#166534' : '#555',
          }}
        >
          {site.status === 'ACTIVE' ? 'включён' : 'на паузе'}
        </span>
        <a
          href={snippet.demoUrl}
          target="_blank"
          rel="noreferrer"
          data-testid="site-card-demo"
          style={{ marginLeft: 'auto', fontSize: 14 }}
          title="Страница со счётчиком на адресе API: открыть с телефона и нажать кнопки"
        >
          демо-страница ↗
        </a>
        <Link href={`/analytics?site=${site.id}`} style={{ fontSize: 14 }}>
          отчёт →
        </Link>
      </div>
      <div style={facts}>
        <Fact label="Ключ" value={site.publicKey} testId="site-card-key" />
        <Fact
          label="Последнее событие"
          value={
            status.lastEventAt
              ? new Date(status.lastEventAt).toLocaleString('ru-RU', { timeZone: site.timezone })
              : 'ещё не было'
          }
          testId="site-card-last"
        />
        <Fact
          label="Сессий сегодня"
          value={String(status.sessionsToday)}
          testId="site-card-today"
        />
        <Fact label="Просмотров сегодня" value={String(status.pageviewsToday)} />
      </div>
      <div style={{ fontSize: 13, color: '#444', margin: '10px 0 4px' }}>
        Код для вставки в &lt;head&gt; сайта:
      </div>
      <pre
        data-testid="site-card-snippet"
        style={{
          background: '#f6f7f9',
          border: '1px solid #e3e5e8',
          borderRadius: 6,
          padding: '10px 12px',
          fontSize: 12,
          overflowX: 'auto',
          margin: '0 0 8px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {snippet.code}
      </pre>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'start' }}>
        <CopyButton text={snippet.code} />
        <SiteButtons id={site.id} status={site.status} />
      </div>

      <div style={{ borderTop: '1px solid #f0f1f3', marginTop: 14, paddingTop: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Бронирование с сайта</div>
        <BookingSettings
          id={site.id}
          enabled={site.bookingEnabled}
          ratePlanCode={site.bookingRatePlan?.code ?? ''}
          plans={plans}
        />
        {site.bookingEnabled && (
          <>
            <div style={{ fontSize: 13, color: '#444', margin: '10px 0 4px' }}>
              Второй код — виджет: вставьте туда, где на сайте должна быть форма бронирования (тариф
              «{site.bookingRatePlan?.name}», бронь сразу подтверждается, оплата при заселении):
            </div>
            <pre
              data-testid="site-card-booking-snippet"
              style={{
                background: '#f6f7f9',
                border: '1px solid #e3e5e8',
                borderRadius: 6,
                padding: '10px 12px',
                fontSize: 12,
                overflowX: 'auto',
                margin: '0 0 8px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {snippet.bookingCode}
            </pre>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <CopyButton text={snippet.bookingCode} />
              <a
                href={snippet.bookingDemoUrl}
                target="_blank"
                rel="noreferrer"
                data-testid="site-card-booking-demo"
                style={{ fontSize: 14 }}
              >
                демо бронирования ↗
              </a>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Fact({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600 }} data-testid={testId}>
        {value}
      </div>
    </div>
  );
}

const box: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e3e5e8',
  borderRadius: 8,
  padding: '14px 16px',
  marginBottom: 16,
};
const facts: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: 12,
  margin: '10px 0',
};
const h2: React.CSSProperties = { fontSize: 16, margin: '0 0 10px' };
