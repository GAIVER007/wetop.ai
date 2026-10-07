import '../hotel-settings/settings.css';
import Link from 'next/link';
import { Page } from '../../components/page';
import { RefreshButton } from '../../components/refresh-button';
import { EmptyState, Panel } from '../../components/ui';
import { Icon } from '../../components/icon';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import { pluralRu } from '../../lib/plural';
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
  const sp = normalizeSearchParams(await searchParams);
  const tab = sp.tab === 'available' ? 'available' : 'connected';
  const state = await loadChannexState();
  const { card: channex, propertyName, clock, now, technical } = state;
  const connected = channex.health === 'off' ? [] : [channex];
  const available = channex.health === 'off' ? [channex] : [];
  const tabHref = (next: 'connected' | 'available') =>
    next === 'available' ? '/connections?tab=available' : '/connections';
  return (
    <Page
      actions={
        <Link className="btn btn--secondary" href="/incidents">
          Ошибки системы
        </Link>
      }
      title="Подключения"
      className="integrations-page"
      subtitle={
        propertyName
          ? `Подключения внешних сервисов для ${propertyName}.`
          : 'Подключения внешних сервисов объекта.'
      }
    >
      <nav className="settings-tabs" aria-label="Интеграции">
        <Link href={tabHref('connected')} aria-current={tab === 'connected' ? 'page' : undefined}>
          Подключения <span className="integration-tab__count">{connected.length}</span>
        </Link>
        <Link href={tabHref('available')} aria-current={tab === 'available' ? 'page' : undefined}>
          Доступные <span className="integration-tab__count">{available.length}</span>
        </Link>
      </nav>
      {tab === 'connected' ? (
        connected.length ? (
          <div className="integration-list" data-testid="integrations-connected">
            <ChannexConnected
              card={channex}
              propertyName={propertyName}
              clock={clock}
              now={now}
              technical={technical}
            />
          </div>
        ) : (
          <EmptyState
            data-testid="integrations-empty"
            icon={<Icon name="channels" width={32} height={32} />}
            title="Интеграции ещё не подключены"
            actions={
              <Link className="btn btn--secondary" href={tabHref('available')}>
                Посмотреть доступные
              </Link>
            }
          >
            Подключите внешние сервисы для обмена бронированиями и другими данными.
          </EmptyState>
        )
      ) : available.length ? (
        <div className="integration-list" data-testid="integrations-available">
          <ChannexAvailable readOnly={state.readOnly} />
        </div>
      ) : (
        <EmptyState
          data-testid="integrations-available-empty"
          icon={<Icon name="channels" width={32} height={32} />}
          title="Других доступных интеграций пока нет"
        >
          Новые подключения появятся здесь, когда WETOP начнёт их поддерживать.
        </EmptyState>
      )}
    </Page>
  );
}

function CardHead({ health }: { health: ChannexCard['health'] }) {
  return (
    <header className="integration-card__head">
      <div>
        <h2 className="integration-card__name">Менеджер каналов</h2>
        <p className="integration-card__kind">Booking.com, Trip.com и другие каналы</p>
      </div>
      <HealthBadge health={health} />
    </header>
  );
}

function ChannexConnected({
  card,
  propertyName,
  clock,
  now,
  technical,
}: {
  card: ChannexCard;
  propertyName: string | null;
  clock: PropertyClock;
  now: Date;
  technical: boolean;
}) {
  const c = card.connection;
  return (
    <Panel className="integration-card" id="channex-connection" data-testid="integration-channex">
      <CardHead health={card.health} />
      <EnvironmentNote environment={c?.environment} />
      <IssueList issues={card.issues} />
      <dl className="integration-card__facts">
        <div>
          <dt>Объект</dt>
          <dd>{propertyName ?? '—'}</dd>
        </div>
        <div>
          <dt>Последний обмен</dt>
          <dd data-testid="integration-last-exchange">
            {card.lastExchangeAt ? (
              <time dateTime={card.lastExchangeAt}>
                {exchangeLine(card.lastExchangeAt, clock, now)}
              </time>
            ) : (
              '—'
            )}
          </dd>
        </div>
        {c && (
          <div>
            <dt>Сопоставлено</dt>
            <dd>
              {pluralRu(c.mappedCategories, ['категория', 'категории', 'категорий'])},{' '}
              {pluralRu(c.mappedLocalRatePlans, [
                'тарифный план',
                'тарифных плана',
                'тарифных планов',
              ])}
              , {pluralRu(c.mappedRatePlans, ['сопоставление', 'сопоставления', 'сопоставлений'])}
            </dd>
          </div>
        )}
      </dl>
      <div className="integration-card__actions">
        <RefreshButton label="Проверить соединение" />
        <Link className="btn btn--secondary" href="/connections/channex">
          Настройки
        </Link>
        <Link className="btn btn--ghost" href="/channels">
          Каналы продаж
        </Link>
      </div>
      {technical && <TechDetails card={card} clock={clock} />}
      <p className="note" data-testid="channel-content-location">
        {CHANNEX_CONTENT_NOTE}
      </p>
    </Panel>
  );
}

/**
 * Ключ Channex хранится на сервере установки (ADR-004, ADR-095): подключает поддержка WETOP, поля для ключа в
 * интерфейсе нет. Кнопки «Подключить», которая ничего не подключает, тоже нет.
 */
function ChannexAvailable({ readOnly }: { readOnly: boolean }) {
  return (
    <Panel className="integration-card" id="channex-connection" data-testid="integration-channex">
      <CardHead health="off" />
      <p className="integration-card__about">{CHANNEX_ABOUT}</p>
      <p className="integration-card__how" data-testid="integration-connect">
        {readOnly ? CHANNEX_READ_ONLY : CHANNEX_SUPPORT}
      </p>
      <p className="note" data-testid="channel-content-location">
        {CHANNEX_CONTENT_NOTE}
      </p>
    </Panel>
  );
}
