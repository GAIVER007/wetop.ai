import Link from 'next/link';
import { analyticsApi, type TrackedSiteCard } from '../../lib/api';
import { propertyClock } from '../../lib/property-time';
import { WEBSITE_TITLE, primaryHost, siteState } from '../../lib/website';
import { Page } from '../../components/page';
import { Icon } from '../../components/icon';
import { Notice, StateBar, StateFact, Stack } from '../../components/ui';
import { WebsiteNotConnected, WebsiteTabs } from './parts';

/**
 * «Сайт и онлайн-бронирование → Обзор» (ADR-117, WEB1): как сайт объекта связан с WETOP — одним взглядом.
 * Сайт с доменом-заглушкой подключённым не считается: вместо зелёной карточки — пустое состояние.
 */
export default async function WebsiteOverviewPage() {
  const sites = await analyticsApi.sites();
  const cards = await Promise.all(sites.map((s) => analyticsApi.card(s.id)));
  const connected = cards.filter((c) => primaryHost(c.site));
  const drafts = cards.filter((c) => !primaryHost(c.site));
  return (
    <Page
      title={WEBSITE_TITLE}
      subtitle="Как сайт объекта связан с WETOP: домен, счётчик посещений и брони с сайта."
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
              «{draft.site.name}» — адрес сайта не указан.{' '}
              <Link href="/website/settings">Указать адрес</Link>
            </Notice>
          ))}
        </Stack>
      )}
    </Page>
  );
}

async function SiteOverview({ card }: { card: TrackedSiteCard }) {
  const state = siteState(card, propertyClock(card.site.timezone));
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
          Открыть сайт <Icon name="external" width={14} />
        </a>
      }
      data-testid="website-overview"
      data-state={state.counter.state}
    >
      <StateFact label="Домен" value={state.host}>
        Подключён
      </StateFact>
      <StateFact label="Счётчик" value={state.counter.value} data-testid="website-counter">
        {state.counter.note}
      </StateFact>
      <StateFact
        label="Онлайн-бронирование"
        value={state.booking.value}
        data-testid="website-booking"
      >
        {state.booking.note}
      </StateFact>
      <StateFact
        label="Брони с сайта"
        value={report ? String(report.siteReservations.count) : '—'}
        data-testid="website-bookings"
      >
        {report ? 'в этом месяце' : 'отчёт не загрузился'}
      </StateFact>
    </StateBar>
  );
}
