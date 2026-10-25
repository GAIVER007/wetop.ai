import { requireFeature } from '../../lib/vertical-guard';
import Link from 'next/link';
import { Page } from '../../components/page';
import { RefreshButton } from '../../components/refresh-button';
import { EmptyState, Panel } from '../../components/ui';
import { Icon } from '../../components/icon';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import { countLabel, msg, type DeskLocale, type Translate } from '../../i18n';
import { currentLocale, serverT } from '../../i18n/server';
import type { PropertyClock } from '../../lib/property-time';
import { exchangeLine, type ChannexCard } from '../../lib/integrations';
import { loadChannexState } from './connection-state';
import {
  CHANNEX_ABOUT,
  CHANNEX_CONTENT_NOTE,
  CHANNEX_READ_ONLY,
  CHANNEX_SUPPORT,
  HealthBadge,
  EnvironmentNote,
  IssueList,
  TechDetails,
} from './connection-parts';
import './integrations.css';
import { Tabs } from '../../components/tabs';

/**
 * «Интеграции» v2, срез INT1 (ADR-116, план `plans/integrations-int1-2026-09-27.md`): внешние подключения объекта,
 * их состояние и место настройки. Внутренней диагностики (база, Supabase, число броней и номеров) здесь нет — она у
 * главного администратора в «Платформе». Сайт и виджет — модуль самого WETOP, живут в «Настройки → Сайт».
 * Channex здесь — только соединение и его сводка; очередь, сопоставления и события — в «Каналах продаж».
 * eQonaq не показывается даже «скоро»: отложен без срока (Q-122, решение владельца 28.09.2026).
 */
export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // гостиничный экран: салон и ресторан по прямому адресу уходят на свою стартовую (DS2 F1, как `/reports`)
  await requireFeature('/connections');
  const sp = normalizeSearchParams(await searchParams);
  const tab = sp.tab === 'available' ? 'available' : 'connected';
  const state = await loadChannexState();
  const { card: channex, propertyName, clock, now, technical } = state;
  const connected = channex.health === 'off' ? [] : [channex];
  const available = channex.health === 'off' ? [channex] : [];
  const t = await serverT();
  const locale = await currentLocale();
  const tabHref = (next: 'connected' | 'available') =>
    next === 'available' ? '/connections?tab=available' : '/connections';
  return (
    <Page
      actions={
        <Link className="btn btn--secondary" href="/incidents">
          {t('Ошибки системы')}
        </Link>
      }
      title={t('Подключения')}
      className="integrations-page"
      subtitle={
        propertyName
          ? t('Подключения внешних сервисов для {name}.', { name: propertyName })
          : t('Подключения внешних сервисов объекта.')
      }
    >
      <Tabs
        label={t('Интеграции')}
        items={[
          { href: tabHref('connected'), label: t('Подключённые'), current: tab === 'connected', count: connected.length },
          { href: tabHref('available'), label: t('Доступные'), current: tab === 'available', count: available.length },
        ]}
      />
      {tab === 'connected' ? (
        connected.length ? (
          <div className="integration-list" data-testid="integrations-connected">
            <ChannexConnected
              card={channex}
              propertyName={propertyName}
              clock={clock}
              now={now}
              technical={technical}
              t={t}
              locale={locale}
            />
          </div>
        ) : (
          <EmptyState
            data-testid="integrations-empty"
            icon={<Icon name="channels" width={32} height={32} />}
            title={t('Интеграции ещё не подключены')}
            actions={
              <Link className="btn btn--secondary" href={tabHref('available')}>
                {t('Посмотреть доступные')}
              </Link>
            }
          >
            {t('Подключите внешние сервисы для обмена бронированиями и другими данными.')}
          </EmptyState>
        )
      ) : available.length ? (
        <div className="integration-list" data-testid="integrations-available">
          <ChannexAvailable readOnly={state.readOnly} t={t} />
        </div>
      ) : (
        <EmptyState
          data-testid="integrations-available-empty"
          icon={<Icon name="channels" width={32} height={32} />}
          title={t('Других доступных интеграций пока нет')}
        >
          {t('Новые подключения появятся здесь, когда WETOP начнёт их поддерживать.')}
        </EmptyState>
      )}
    </Page>
  );
}

function CardHead({ health, t }: { health: ChannexCard['health']; t: Translate }) {
  return (
    <header className="integration-card__head">
      <div>
        <h2 className="integration-card__name">{t('Менеджер каналов')}</h2>
        <p className="integration-card__kind">{t('Booking.com, Trip.com и другие каналы')}</p>
      </div>
      <HealthBadge health={health} t={t} />
    </header>
  );
}

function ChannexConnected({
  card,
  propertyName,
  clock,
  now,
  technical,
  t,
  locale,
}: {
  card: ChannexCard;
  propertyName: string | null;
  clock: PropertyClock;
  now: Date;
  technical: boolean;
  t: Translate;
  locale: DeskLocale;
}) {
  const c = card.connection;
  return (
    <Panel className="integration-card" id="channex-connection" data-testid="integration-channex">
      <CardHead health={card.health} t={t} />
      <EnvironmentNote environment={c?.environment} t={t} />
      <IssueList issues={card.issues} t={t} />
      <dl className="integration-card__facts">
        <div>
          <dt>{t('Объект')}</dt>
          <dd>{propertyName ?? '—'}</dd>
        </div>
        <div>
          <dt>{t('Последний обмен')}</dt>
          <dd data-testid="integration-last-exchange">
            {card.lastExchangeAt ? (
              <time dateTime={card.lastExchangeAt}>
                {exchangeLine(card.lastExchangeAt, clock, now, t)}
              </time>
            ) : (
              '—'
            )}
          </dd>
        </div>
        {c && (
          <div>
            <dt>{t('Сопоставлено')}</dt>
            <dd>
              {countLabel(locale, t, c.mappedCategories, [msg('категория'), msg('категории'), msg('категорий')])},{' '}
              {countLabel(locale, t, c.mappedLocalRatePlans, [
                msg('тарифный план'),
                msg('тарифных плана'),
                msg('тарифных планов'),
              ])}
              ,{' '}
              {countLabel(locale, t, c.mappedRatePlans, [
                msg('сопоставление'),
                msg('сопоставления'),
                msg('сопоставлений'),
              ])}
            </dd>
          </div>
        )}
      </dl>
      <div className="integration-card__actions">
        <RefreshButton label={t('Проверить соединение')} />
        <Link className="btn btn--secondary" href="/connections/channex">
          {t('Настройки')}
        </Link>
        <Link className="btn btn--ghost" href="/channels">
          {t('Каналы продаж')}
        </Link>
      </div>
      {technical && <TechDetails card={card} clock={clock} t={t} />}
      <p className="note" data-testid="channel-content-location">
        {t(CHANNEX_CONTENT_NOTE)}
      </p>
    </Panel>
  );
}

/**
 * Ключ Channex хранится на сервере установки (ADR-004, ADR-095): подключает поддержка WETOP, поля для ключа в
 * интерфейсе нет. Кнопки «Подключить», которая ничего не подключает, тоже нет.
 */
function ChannexAvailable({ readOnly, t }: { readOnly: boolean; t: Translate }) {
  return (
    <Panel className="integration-card" id="channex-connection" data-testid="integration-channex">
      <CardHead health="off" t={t} />
      <p className="integration-card__about">{t(CHANNEX_ABOUT)}</p>
      <p className="integration-card__how" data-testid="integration-connect">
        {readOnly ? t(CHANNEX_READ_ONLY) : t(CHANNEX_SUPPORT)}
      </p>
      <p className="note" data-testid="channel-content-location">
        {t(CHANNEX_CONTENT_NOTE)}
      </p>
    </Panel>
  );
}
