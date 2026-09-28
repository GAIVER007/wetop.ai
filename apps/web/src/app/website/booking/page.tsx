import Link from 'next/link';
import { analyticsApi, reservationsApi, type TrackedSiteCard } from '../../../lib/api';
import { hotelApi, type HotelSettings } from '../../../lib/hotel-api';
import { propertyClock } from '../../../lib/property-time';
import { WEBSITE_TITLE, siteState } from '../../../lib/website';
import { Page } from '../../../components/page';
import { Alert, Badge, Panel, Row, Stack, StateBar, StateFact } from '../../../components/ui';
import { BookingSettings, CopyButton } from '../forms';
import { WebsiteNotConnected, WebsiteTabs } from '../parts';

/**
 * «Сайт и онлайн-бронирование → Бронирование» (ADR-117, WEB1): бывший блок «Бронирование с сайта» со страницы
 * настроек сайта. Виджет ничего не решает сам (ADR-026): места и цены — те же правила, что у стойки, бронь сразу
 * в PMS с источником «сайт», без предоплаты. Настроек виджета, которых нет в модели, здесь нет (WEB3).
 */
export default async function WebsiteBookingPage() {
  const sites = await analyticsApi.sites();
  const [cards, plans, settings] = await Promise.all([
    Promise.all(sites.map((s) => analyticsApi.card(s.id))),
    reservationsApi.ratePlans().catch(() => null),
    hotelApi.settings().catch(() => null),
  ]);
  return (
    <Page
      title={WEBSITE_TITLE}
      subtitle="Виджет на сайте объекта: свободные места, цены и бронь сразу в PMS."
    >
      <WebsiteTabs current="booking" />
      {cards.length === 0 ? (
        <WebsiteNotConnected drafts={[]} />
      ) : (
        <div className="settings-site">
          <Stack>
            {cards.map((card) => (
              <SiteBooking key={card.site.id} card={card} plans={plans} settings={settings} />
            ))}
          </Stack>
        </div>
      )}
    </Page>
  );
}

function SiteBooking({
  card,
  plans,
  settings,
}: {
  card: TrackedSiteCard;
  plans: Array<{ code: string; name: string }> | null;
  settings: HotelSettings | null;
}) {
  const { site, snippet } = card;
  const state = siteState(card, propertyClock(site.timezone));
  const previewAvailable = (url: string) => {
    try {
      return ['https:', 'http:'].includes(new URL(url).protocol);
    } catch {
      return false;
    }
  };
  return (
    <Stack>
      <StateBar
        className="state-bar--wide"
        tone={state.booking.tone}
        label="Онлайн-бронирование"
        value={state.booking.value}
        summary="Бронь сразу в PMS, оплата при заселении"
        data-testid="website-booking-state"
        data-state={state.booking.state}
      >
        <StateFact label="Основной домен" value={state.host ?? 'не указан'} />
        <StateFact label="Объект" value={settings?.property.name ?? '—'} />
        <StateFact label="Валюта" value={settings?.property.currency ?? '—'} />
        <StateFact label="Тариф" value={site.bookingRatePlan?.name ?? 'не выбран'} />
      </StateBar>

      <p className="hint--lg" data-testid="booking-explained">
        Когда гость выбирает даты на вашем сайте, WETOP показывает свободные места и цены по тарифу
        сайта и создаёт бронь сразу в PMS — с источником «сайт», как на шахматке и в «Бронях».
      </p>
      {!state.connected && (
        <Alert tone="warning" data-testid="booking-domain-missing">
          Основной домен не настроен: виджет примет брони только с адреса сайта.{' '}
          <Link href="/website/settings">Добавить домен</Link>
        </Alert>
      )}
      {state.booking.state === 'paused' && (
        <Alert tone="warning" data-testid="booking-site-paused">
          Сайт приостановлен: виджет не принимает брони.{' '}
          <Link href="/website/settings">Возобновить в «Настройках»</Link>
        </Alert>
      )}

      <Panel
        size="lg"
        className="site-settings-card"
        data-testid="site-card"
        data-key={site.publicKey}
      >
        <h2>Настройки бронирования</h2>
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
          <details className="settings-disclosure">
            <summary>Установка виджета бронирования</summary>
            <div>
              <div className="hint--lg block--top block--bottom-xs">
                Вставьте код туда, где на сайте должна быть форма бронирования (тариф «
                {site.bookingRatePlan?.name}», бронь сразу подтверждается, оплата при заселении):
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
                    Открыть демо виджета
                  </a>
                ) : (
                  <Badge>Демо виджета не подключено</Badge>
                )}
              </Row>
              {/* Демо работает на живом API: бронь с него — обычная бронь PMS, а не примерка (§7.3) */}
              <p className="note" data-testid="booking-demo-warning">
                Бронь с демо-страницы настоящая: она попадёт в PMS, займёт место и откроет счёт.
                После проверки отмените её на карточке брони.
              </p>
            </div>
          </details>
        )}
      </Panel>
    </Stack>
  );
}
