import Link from 'next/link';
import { analyticsApi, reservationsApi, type TrackedSiteCard } from '../../../lib/api';
import { Page } from '../../../components/page';
import { Alert, Badge, Fact, Help, Panel, Row, SectionTitle, Stack } from '../../../components/ui';
import { BookingSettings, CopyButton, CreateSiteForm, HostsForm, SiteButtons } from './forms';

/** Подключение счётчика: сайты, код для вставки, статус. Постоянный публичный адрес API — Q-112. */
export default async function AnalyticsSetupPage() {
  const sites = await analyticsApi.sites();
  const cards = await Promise.all(sites.map((s) => analyticsApi.card(s.id)));
  const plans = await reservationsApi.ratePlans().catch(() => null);
  const scriptUrl = cards[0]?.snippet.scriptUrl ?? null;
  const localOnly = !scriptUrl || /127\.0\.0\.1|localhost/.test(scriptUrl);
  const insecure = !!scriptUrl && !localOnly && !scriptUrl.startsWith('https://');
  return (
    <Page title="Подключение счётчика" actions={<Link href="/analytics">отчёт</Link>}>
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
          <SiteCard key={c.site.id} card={c} plans={plans} />
        ))}

        <Panel size="lg">
          <SectionTitle first>{cards.length ? 'Ещё один сайт' : 'Добавить сайт'}</SectionTitle>
          <CreateSiteForm />
        </Panel>

        <Help title="Инструкция по установке">
          <ol className="list hint--lg list--gap">
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
        </Help>
      </Stack>
    </Page>
  );
}

function SiteCard({
  card,
  plans,
}: {
  card: TrackedSiteCard;
  plans: Array<{ code: string; name: string }> | null;
}) {
  const { site, status, snippet } = card;
  const previewAvailable = (url: string) => {
    try {
      return ['https:', 'http:'].includes(new URL(url).protocol);
    } catch {
      return false;
    }
  };
  return (
    <Panel size="lg" data-testid="site-card" data-key={site.publicKey}>
      <Row gap="lg" className="row--baseline">
        <b className="panel__title panel__title--lg" data-testid="site-card-name">
          {site.name}
        </b>
        <span className="sub">{site.hosts.join(', ')}</span>
        <Badge tone={site.status === 'ACTIVE' ? 'ok' : 'neutral'} data-testid="site-card-status">
          {site.status === 'ACTIVE' ? 'включён' : 'на паузе'}
        </Badge>
        {previewAvailable(snippet.demoUrl) ? (
          <a
            href={snippet.demoUrl}
            target="_blank"
            rel="noreferrer"
            data-testid="site-card-demo"
            className="ml-auto"
            title="Страница со счётчиком на адресе API: открыть с телефона и нажать кнопки"
          >
            демо-страница
          </a>
        ) : (
          <Badge>Демо счётчика не подключено</Badge>
        )}
        <Link href={`/analytics?site=${site.id}`}>отчёт</Link>
      </Row>
      <div className="facts">
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
      {site.hosts.some((h) => h.endsWith('.example')) && (
        <Alert tone="warning">
          Домен-заглушка: впишите настоящий адрес сайта, иначе приёмник и виджет не примут запросы с
          него.
        </Alert>
      )}
      <HostsForm id={site.id} hosts={site.hosts} />
      <div className="hint--lg">Код для вставки в &lt;head&gt; сайта:</div>
      <pre data-testid="site-card-snippet" className="code">
        {snippet.code}
      </pre>
      <Row className="items-start">
        <CopyButton text={snippet.code} />
        <SiteButtons id={site.id} status={site.status} />
      </Row>

      <div className="divider">
        <div className="panel__title block--bottom-xs">Бронирование с сайта</div>
        {plans ? (
          <BookingSettings
            id={site.id}
            enabled={site.bookingEnabled}
            ratePlanCode={site.bookingRatePlan?.code ?? ''}
            plans={plans}
          />
        ) : (
          <Alert>Не удалось загрузить тарифы. Обновите страницу.</Alert>
        )}
        {site.bookingEnabled && (
          <>
            <div className="hint--lg block--top block--bottom-xs">
              Второй код — виджет: вставьте туда, где на сайте должна быть форма бронирования (тариф
              «{site.bookingRatePlan?.name}», бронь сразу подтверждается, оплата при заселении):
            </div>
            <pre data-testid="site-card-booking-snippet" className="code">
              {snippet.bookingCode}
            </pre>
            <Row>
              <CopyButton text={snippet.bookingCode} />
              {previewAvailable(snippet.bookingDemoUrl) ? (
                <a
                  href={snippet.bookingDemoUrl}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="site-card-booking-demo"
                >
                  демо бронирования
                </a>
              ) : (
                <Badge>Демо виджета не подключено</Badge>
              )}
            </Row>
          </>
        )}
      </div>
    </Panel>
  );
}
