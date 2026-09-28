import { analyticsApi, type TrackedSiteCard } from '../../../lib/api';
import { propertyClock } from '../../../lib/property-time';
import { WEBSITE_TITLE, siteState } from '../../../lib/website';
import { Page } from '../../../components/page';
import { Alert, Badge, Fact, Help, Panel, Row, SectionTitle, Stack } from '../../../components/ui';
import {
  CheckCounterButton,
  CopyButton,
  CreateSiteForm,
  HostsForm,
  SiteDangerZone,
} from '../forms';
import { WebsiteTabs } from '../parts';
import '../../directory.css';

/**
 * «Сайт и онлайн-бронирование → Настройки» (ADR-117, WEB1): бывшие «Настройки сайта» (`/analytics/setup`) без блока
 * бронирования — он во вкладке «Бронирование». Домены, счётчик и код; пауза и удаление — в «Опасной зоне».
 * Постоянный публичный адрес API — Q-112. Домены списком и окно установки — WEB2.
 */
export default async function WebsiteSettingsPage() {
  const sites = await analyticsApi.sites();
  const cards = await Promise.all(sites.map((s) => analyticsApi.card(s.id)));
  const scriptUrl = cards[0]?.snippet.scriptUrl ?? null;
  const localOnly = !scriptUrl || /127\.0\.0\.1|localhost/.test(scriptUrl);
  const insecure = !!scriptUrl && !localOnly && !scriptUrl.startsWith('https://');
  return (
    <Page title={WEBSITE_TITLE} subtitle="Домены сайта, счётчик посещений и установка кода.">
      <WebsiteTabs current="settings" />
      <div className="settings-site">
        <Stack>
          {cards.length > 0 && localOnly && (
            <Alert boxed tone="warning" data-testid="setup-local-warning">
              Укажите постоянный публичный адрес API: текущий код доступен только локально.
            </Alert>
          )}

          {cards.length > 0 && insecure && (
            <Alert boxed data-testid="setup-insecure-warning">
              Укажите HTTPS-адрес API, чтобы счётчик работал на сайте.
            </Alert>
          )}

          {cards.map((c) => (
            <SiteCard key={c.site.id} card={c} />
          ))}

          <Panel size="lg">
            <SectionTitle first>{cards.length ? 'Ещё один сайт' : 'Подключить сайт'}</SectionTitle>
            <CreateSiteForm />
          </Panel>

          <Help title="Инструкция по установке">
            <ol className="list hint--lg list--gap">
              <li>
                Вставьте код счётчика в &lt;head&gt; каждой страницы сайта (в Tilda и WordPress —
                поле «HTML-код в head»).
              </li>
              <li>
                Счётчик шлёт только: адрес и заголовок страницы, реферер, ширину экрана, язык,
                часовой пояс и случайные ID посетителя и сессии. Без cookies, без IP, без имён и
                телефонов.
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
                Нужен баннер согласия — добавьте атрибут <code>data-consent=&quot;wait&quot;</code>{' '}
                и вызовите <code>pms(&apos;consent&apos;)</code> после согласия.
              </li>
              <li>
                Нажмите «Проверить счётчик» после первого захода на сайт — здесь появится время
                последнего события. Проверить без сайта: откройте демо-страницу из «Установки
                счётчика» с телефона и нажмите кнопки на ней.
              </li>
            </ol>
          </Help>
        </Stack>
      </div>
    </Page>
  );
}

function SiteCard({ card }: { card: TrackedSiteCard }) {
  const { site, status, snippet } = card;
  const clock = propertyClock(site.timezone);
  const state = siteState(card, clock);
  const previewAvailable = (url: string) => {
    try {
      return ['https:', 'http:'].includes(new URL(url).protocol);
    } catch {
      return false;
    }
  };
  // Одна плашка состояния вместо пары «Счётчик включён» + «Ожидает первых событий» (ADR-117)
  const badge = !state.connected
    ? { tone: 'warn' as const, text: 'Адрес не указан' }
    : state.counter.state === 'today'
      ? { tone: 'ok' as const, text: state.counter.value }
      : { tone: 'neutral' as const, text: state.counter.value };
  return (
    <Panel
      size="lg"
      className="site-settings-card"
      data-testid="site-card"
      data-key={site.publicKey}
    >
      <Row gap="lg" className="row--baseline">
        <h2 className="panel__title panel__title--lg" data-testid="site-card-name">
          {site.name}
        </h2>
        <Badge tone={badge.tone} data-testid="site-card-status">
          {badge.text}
        </Badge>
      </Row>

      <h3 className="site-domains-heading">Домены</h3>
      {!state.connected && (
        <Alert tone="warning" data-testid="site-domain-missing">
          Основной домен не настроен. Добавьте адрес сайта, с которого WETOP будет принимать
          посещения и запросы бронирования.
        </Alert>
      )}
      <HostsForm id={site.id} hosts={site.hosts} />

      <div className="divider">
        <h3>Счётчик WETOP</h3>
        <div className="facts">
          <Fact
            label="Последнее событие"
            value={status.lastEventAt ? clock.local(status.lastEventAt) : 'ещё не было'}
            testId="site-card-last"
          />
          <Fact
            label="Сессий сегодня"
            value={String(status.sessionsToday)}
            testId="site-card-today"
          />
          <Fact label="Просмотров сегодня" value={String(status.pageviewsToday)} />
        </div>
        <CheckCounterButton id={site.id} />
        <details className="settings-disclosure">
          <summary>Установка счётчика</summary>
          <div>
            <Fact label="Публичный ключ сайта" value={site.publicKey} testId="site-card-key" />
            <p className="settings-note">Вставьте код в &lt;head&gt; страниц сайта.</p>
            <pre data-testid="site-card-snippet" className="code">
              {snippet.code}
            </pre>
            <Row className="items-start">
              <CopyButton text={snippet.code} />
              {previewAvailable(snippet.demoUrl) ? (
                <a
                  href={snippet.demoUrl}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="site-card-demo"
                  title="Страница со счётчиком на адресе API: открыть с телефона и нажать кнопки"
                >
                  Открыть демо-страницу счётчика
                </a>
              ) : (
                <Badge>Демо счётчика не подключено</Badge>
              )}
            </Row>
          </div>
        </details>
      </div>

      <section className="panel panel--danger block--top" data-testid="site-danger">
        <b className="panel__title">Опасная зона</b>
        <p className="hint">
          Приостановка останавливает и счётчик, и бронирование с сайта. Удаление стирает накопленную
          статистику — вернуть её нельзя.
        </p>
        <SiteDangerZone id={site.id} status={site.status} />
      </section>
    </Panel>
  );
}
