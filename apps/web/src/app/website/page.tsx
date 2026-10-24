import { requireFeature } from '../../lib/vertical-guard';
import Link from 'next/link';
import { analyticsApi, type TrackedSiteCard } from '../../lib/api';
import { propertyClock } from '../../lib/property-time';
import { WEBSITE_TITLE, primaryHost, siteState } from '../../lib/website';
import { Page } from '../../components/page';
import { Icon } from '../../components/icon';
import { Notice, StateBar, StateFact, Stack } from '../../components/ui';
import { MarketingCrumb, WebsiteNotConnected, WebsiteTabs } from './parts';
import './website.css';
import { serverT } from '../../i18n/server';

/**
 * «Сайт и онлайн-бронирование → Обзор» (ADR-117, WEB1): как сайт объекта связан с WETOP — одним взглядом.
 * Сайт с доменом-заглушкой подключённым не считается: вместо зелёной карточки — пустое состояние.
 */
export default async function WebsiteOverviewPage() {
  // сайт и онлайн-бронь гостиницы; у салона и ресторана сайт в «Продвижении» (аудит 17.10.2026, Д11)
  await requireFeature('/website');
  const t = await serverT();
  const sites = await analyticsApi.sites();
  const cards = await Promise.all(sites.map((s) => analyticsApi.card(s.id)));
  const connected = cards.filter((c) => primaryHost(c.site));
  const drafts = cards.filter((c) => !primaryHost(c.site));
  return (
    <Page
      crumbs={<MarketingCrumb />}
      title={t(WEBSITE_TITLE)}
      subtitle={t('Как сайт объекта связан с WETOP: домен, счётчик посещений и брони с сайта.')}
    >
      <WebsiteTabs current="overview" />
      {connected.length === 0 ? (
        <WebsiteNotConnected drafts={drafts} />
      ) : (
        <Stack>
          {connected.map((card) => (
            <SiteOverview key={card.site.id} card={card} />
          ))}
          {drafts.map((draft) => (
            <Notice tone="muted" key={draft.site.id} data-testid="website-draft">
              {t('«{name}» — адрес сайта не указан.', { name: draft.site.name })}{' '}
              <Link href="/website/settings">{t('Указать адрес')}</Link>
            </Notice>
          ))}
        </Stack>
      )}
    </Page>
  );
}

async function SiteOverview({ card }: { card: TrackedSiteCard }) {
  const t = await serverT();
  const state = siteState(card, propertyClock(card.site.timezone), undefined, t);
  // «Брони с сайта» за этот месяц — то же число, что блок «Брони с сайта» во вкладке «Аналитика» (WEB4, Q-212)
  const report = await analyticsApi.report(card.site.id).catch(() => null);
  return (
    <StateBar
      className="state-bar--wide"
      tone={state.overall.tone}
      label={state.host}
      value={state.overall.value}
      summary={
        <a
          href={`https://${state.host}`}
          target="_blank"
          rel="noreferrer"
          data-testid="website-open"
        >
          {t('Открыть сайт')} <Icon name="external" width={14} />
        </a>
      }
      data-testid="website-overview"
      data-state={state.counter.state}
    >
      <StateFact label={t('Домен')} value={state.host}>
        {t('Подключён')}
      </StateFact>
      <StateFact label={t('Счётчик')} value={state.counter.value} data-testid="website-counter">
        {state.counter.note}
      </StateFact>
      <StateFact
        label={t('Онлайн-бронирование')}
        value={state.booking.value}
        data-testid="website-booking"
      >
        {state.booking.note}
      </StateFact>
      <StateFact
        label={t('Брони с сайта')}
        value={report ? String(report.siteReservations.count) : '—'}
        data-testid="website-bookings"
      >
        {report ? t('новые в этом месяце') : t('отчёт не загрузился')}
      </StateFact>
    </StateBar>
  );
}
