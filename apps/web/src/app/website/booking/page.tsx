import { requireFeature } from '../../../lib/vertical-guard';
import Link from 'next/link';
import { analyticsApi, reservationsApi, type TrackedSiteCard } from '../../../lib/api';
import { hotelApi, type HotelSettings } from '../../../lib/hotel-api';
import { propertyClock } from '../../../lib/property-time';
import { WEBSITE_TITLE, isOpenableUrl, siteState } from '../../../lib/website';
import { Page } from '../../../components/page';
import { Icon } from '../../../components/icon';
import { Alert, Panel, Row, Stack, StateBar, StateFact } from '../../../components/ui';
import { BookingSettings, InstallWidgetButton } from '../forms';
import { ManagedSitesNotice, MarketingCrumb, WebsiteNotConnected, WebsiteTabs } from '../parts';
import '../website.css';
import { bookingDemoHref } from '../../../lib/booking-demo';
import { serverT } from '../../../i18n/server';

/**
 * «Сайт и онлайн-бронирование → Бронирование» (ADR-117, WEB1; WEB3 — состояние, демо, «Что увидит гость», окно
 * установки). Виджет ничего не решает сам (ADR-026): места и цены — те же правила, что у стойки, бронь сразу в PMS
 * с источником «сайт», без предоплаты. Настраивается только то, что есть в модели: включение и тариф сайта.
 */
export default async function WebsiteBookingPage() {
  // сайт и онлайн-бронь гостиницы; у салона и ресторана сайт в «Продвижении» (аудит 17.10.2026, Д11)
  await requireFeature('/website/booking');
  const t = await serverT();
  const sites = await analyticsApi.sites();
  const [all, plans, settings] = await Promise.all([
    Promise.all(sites.map((s) => analyticsApi.card(s.id))),
    reservationsApi.ratePlans().catch(() => null),
    hotelApi.settings().catch(() => null),
  ]);
  // MKT7: бронь сайта WETOP настраивает публикация, здесь только ссылка туда
  const cards = all.filter((c) => !c.site.managed);
  const managed = all.filter((c) => c.site.managed);
  return (
    <Page
      crumbs={<MarketingCrumb />}
      title={t(WEBSITE_TITLE)}
      subtitle={t('Виджет на сайте объекта: свободные места, цены и бронь сразу в PMS.')}
    >
      <WebsiteTabs current="booking" />
      <ManagedSitesNotice cards={managed} />
      {cards.length === 0 && managed.length === 0 ? (
        <WebsiteNotConnected drafts={[]} />
      ) : cards.length === 0 ? null : (
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

async function SiteBooking({
  card,
  plans,
  settings,
}: {
  card: TrackedSiteCard;
  plans: Array<{ code: string; name: string }> | null;
  settings: HotelSettings | null;
}) {
  const t = await serverT();
  const { site, snippet } = card;
  const state = siteState(card, propertyClock(site.timezone), undefined, t);
  const working = state.booking.state === 'on';
  const demo = working && isOpenableUrl(snippet.bookingDemoUrl);
  const planName = site.bookingRatePlan?.name;
  const currency = settings?.property.currency;
  return (
    <Stack>
      <StateBar
        className="state-bar--wide"
        tone={state.booking.tone}
        label={t('Онлайн-бронирование')}
        value={state.booking.value}
        summary={working ? t('Бронь сразу в PMS, оплата при заселении') : state.booking.note}
        data-testid="website-booking-state"
        data-state={state.booking.state}
      >
        <StateFact label={t('Основной домен')} value={state.host ?? t('не указан')} />
        <StateFact label={t('Объект')} value={settings?.property.name ?? '—'} />
        <StateFact label={t('Валюта')} value={currency ?? '—'} />
        <StateFact label={t('Тариф')} value={planName ?? t('не выбран')} />
      </StateBar>
      {/* WEB3: демо и код — только у работающего бронирования; живой вид виджета — демо, а не макет в стойке */}
      {site.bookingEnabled && (
        <Row data-testid="booking-actions">
          {demo && (
            <a
              className="btn btn--secondary"
              href={bookingDemoHref(site.id)}
              target="_blank"
              rel="noreferrer"
              data-testid="site-card-booking-demo"
            >
              {t('Открыть демо')} <Icon name="external" width={14} />
            </a>
          )}
          <InstallWidgetButton code={snippet.bookingCode} demoUrl={snippet.bookingDemoUrl} />
        </Row>
      )}

      <p className="hint--lg" data-testid="booking-explained">
        {t('Когда гость выбирает даты на вашем сайте, WETOP показывает свободные места и цены по тарифу сайта и создаёт бронь сразу в PMS — с источником «сайт», как в календаре и в «Бронях».')}
      </p>
      {!state.connected && (
        <Alert tone="warning" data-testid="booking-domain-missing">
          {t('Основной домен не настроен: виджет примет брони только с адреса сайта.')}{' '}
          <Link href="/website/settings">{t('Добавить домен')}</Link>
        </Alert>
      )}
      {state.booking.state === 'paused' && (
        <Alert tone="warning" data-testid="booking-site-paused">
          {t('Сайт приостановлен: виджет не принимает брони.')}{' '}
          <Link href="/website/settings">{t('Возобновить в «Настройках»')}</Link>
        </Alert>
      )}

      <Panel size="lg" data-testid="booking-guest-view">
        <h2>{t('Что увидит гость')}</h2>
        {/* По шагам настоящего виджета (`apps/api/src/web-booking/widget.js`); меняется виджет — меняется и список */}
        <ol className="list hint--lg list--gap">
          <li>{t('Даты заезда и выезда, число гостей — от 1 до 4 — и промокод, если он есть.')}</li>
          <li data-testid="booking-guest-plan">
            {currency
              ? t('Свободные категории тарифа «{plan}» с ценой за весь период, {currency}. Занятые и не проданные в тарифе — с пометкой.', { plan: planName ?? t('не выбран'), currency })
              : t('Свободные категории тарифа «{plan}» с ценой за весь период. Занятые и не проданные в тарифе — с пометкой.', { plan: planName ?? t('не выбран') })}
          </li>
          <li>{t('Имя, фамилия и телефон; почта и комментарий по желанию.')}</li>
          <li>{t('Номер брони и «К оплате при заселении»: бронь сразу подтверждена.')}</li>
          <li data-testid="booking-guest-letter">
            {t('Если гость оставил почту, письмо с подтверждением брони на его языке.')}
          </li>
        </ol>
        {/* ADR-144: языки и письмо-подтверждение сделаны; дети и SMS не решены, предоплата — срез платёжных ссылок */}
        <p className="hint" data-testid="booking-guest-limits">
          {t('Языки формы: русский, казахский, английский, китайский. Пока не умеет: детей, SMS гостю, предоплату. Скидка тарифа и промокода не суммируется: гостю применяется большая.')}
        </p>
      </Panel>

      <Panel
        size="lg"
        className="site-settings-card"
        data-testid="site-card"
        data-key={site.publicKey}
      >
        <h2>{t('Настройки бронирования')}</h2>
        {plans ? (
          <BookingSettings
            id={site.id}
            enabled={site.bookingEnabled}
            ratePlanCode={site.bookingRatePlan?.code ?? ''}
            plans={plans}
          />
        ) : (
          <Alert>{t('Не удалось загрузить тарифы. Обновите страницу.')}</Alert>
        )}
      </Panel>
    </Stack>
  );
}
