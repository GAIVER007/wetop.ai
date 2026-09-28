import { analyticsApi, type TrackedSiteCard } from '../../../lib/api';
import { propertyClock } from '../../../lib/property-time';
import { WEBSITE_TITLE, siteState, type SiteState } from '../../../lib/website';
import { Page } from '../../../components/page';
import { Alert, Badge, Fact, Panel, Row, SectionTitle, Stack } from '../../../components/ui';
import {
  CheckCounterButton,
  CreateSiteForm,
  DomainList,
  InstallCounterButton,
  SiteDangerZone,
} from '../forms';
import { WebsiteTabs } from '../parts';
import '../../directory.css';

/**
 * «Сайт и онлайн-бронирование → Настройки» (ADR-107): бывшие «Настройки сайта» (`/analytics/setup`) без блока
 * бронирования — он во вкладке «Бронирование». WEB2 (28.09): домены списком, состояние счётчика словами с одним
 * действием, установка кода — в окне по кнопке. Пауза и удаление — в «Опасной зоне». Постоянный адрес API — Q-112.
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
            <p className="hint block--bottom-xs">
              Существующий сайт объекта: WETOP будет принимать с него посещения и брони.
            </p>
            <CreateSiteForm />
          </Panel>
        </Stack>
      </div>
    </Page>
  );
}

/** Состояние счётчика словами (WEB2, п. 5 и 7 ТЗ): одна плашка, одна строка, что делать дальше */
const COUNTER_TEXT: Record<
  SiteState['counter']['state'],
  { tone: 'ok' | 'warn' | 'neutral'; title: string; text: (note: string) => string }
> = {
  blocked: {
    tone: 'warn',
    title: 'Сначала адрес сайта',
    text: () => 'Без адреса сайта счётчик не принимает посещения — добавьте домен выше.',
  },
  paused: {
    tone: 'neutral',
    title: 'Приостановлен',
    text: () => 'Посещения не записываются. Возобновить — в «Опасной зоне» ниже.',
  },
  waiting: {
    tone: 'warn',
    title: 'Событий ещё не было',
    text: () =>
      'Установите код на сайт и откройте любую его страницу — здесь появится время первого посещения.',
  },
  today: { tone: 'ok', title: 'Работает', text: (note) => note },
  quiet: { tone: 'warn', title: 'Сегодня событий нет', text: (note) => note },
};

function SiteCard({ card }: { card: TrackedSiteCard }) {
  const { site, status, snippet } = card;
  const clock = propertyClock(site.timezone);
  const state = siteState(card, clock);
  const counter = COUNTER_TEXT[state.counter.state];
  // Одна плашка состояния вместо пары «Счётчик включён» + «Ожидает первых событий» (ADR-107)
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
      <DomainList id={site.id} hosts={site.hosts} />

      <div className="divider" data-testid="counter-state" data-state={state.counter.state}>
        <h3>Счётчик WETOP</h3>
        <p className="hint--lg">
          <Badge tone={counter.tone} data-testid="counter-title">
            {counter.title}
          </Badge>{' '}
          <span data-testid="counter-text">{counter.text(state.counter.note)}</span>
        </p>
        {status.lastEventAt && (
          <div className="facts">
            <Fact
              label="Последнее событие"
              value={clock.local(status.lastEventAt)}
              testId="site-card-last"
            />
            <Fact
              label="Сессий сегодня"
              value={String(status.sessionsToday)}
              testId="site-card-today"
            />
            <Fact label="Просмотров сегодня" value={String(status.pageviewsToday)} />
          </div>
        )}
        <Row className="items-start">
          <InstallCounterButton
            code={snippet.code}
            siteKey={site.publicKey}
            demoUrl={snippet.demoUrl}
          />
          {state.counter.state !== 'blocked' && (
            <CheckCounterButton
              id={site.id}
              label={state.counter.state === 'waiting' ? 'Проверить установку' : 'Проверить'}
            />
          )}
        </Row>
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
