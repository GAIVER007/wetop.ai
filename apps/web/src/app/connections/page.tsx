import Link from 'next/link';
import { channelsApi } from '../../lib/api';
import { Page } from '../../components/page';
import { RefreshButton } from '../../components/refresh-button';
import { Badge, EmptyState, Panel } from '../../components/ui';
import { Icon } from '../../components/icon';
import { hotelApi, hotelClock } from '../../lib/hotel-api';
import { currentMe, deskShell } from '../../lib/desk-shell';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import { pluralRu } from '../../lib/plural';
import type { PropertyClock } from '../../lib/property-time';
import {
  HEALTH_LABEL,
  HEALTH_TONE,
  channexCard,
  exchangeLine,
  settle,
  type ChannexCard,
} from '../../lib/integrations';
import './integrations.css';

/**
 * «Интеграции» v2, срез INT1 (ADR-116, план `plans/integrations-int1-2026-09-27.md`): внешние подключения объекта,
 * их состояние и место настройки. Внутренней диагностики (база, Supabase, число броней и номеров) здесь нет — она у
 * главного администратора в «Платформе». Сайт и виджет — модуль самого WETOP, живут в «Настройки → Сайт».
 * Channex здесь — только соединение и его сводка; очередь, сопоставления и события — в «Каналах продаж».
 */
export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = normalizeSearchParams(await searchParams);
  const tab = sp.tab === 'available' ? 'available' : 'connected';
  const now = new Date();
  const [clock, shell, settings, me, connection, webhook, outbox] = await Promise.all([
    hotelClock(),
    deskShell(),
    settle(hotelApi.settings()),
    settle(currentMe()),
    settle(channelsApi.connection()),
    settle(channelsApi.webhookStatus()),
    settle(channelsApi.outbox()),
  ]);
  const channex = channexCard({ connection, webhook, outbox, now });
  const propertyName = settings.ok ? settings.value.property.name : null;
  // технические детали — владельцу организации и поддержке WETOP, не каждому сотруднику смены
  const user = me.ok ? me.value.user : null;
  const technical = user?.role === 'OWNER' || user?.platformAdmin === true;
  const connected = channex.health === 'off' ? [] : [channex];
  const available = channex.health === 'off' ? [channex] : [];
  const tabHref = (next: 'connected' | 'available') =>
    next === 'available' ? '/connections?tab=available' : '/connections';
  return (
    <Page
      title="Интеграции"
      subtitle={
        propertyName
          ? `Подключения внешних сервисов для ${propertyName}.`
          : 'Подключения внешних сервисов объекта.'
      }
    >
      <nav className="settings-tabs" aria-label="Интеграции">
        <Link href={tabHref('connected')} aria-current={tab === 'connected' ? 'page' : undefined}>
          Подключённые <span className="integration-tab__count">{connected.length}</span>
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
          <ChannexAvailable readOnly={shell.readOnly} />
        </div>
      ) : (
        <EmptyState
          data-testid="integrations-available-empty"
          icon={<Icon name="channels" width={32} height={32} />}
          title="Все доступные интеграции подключены"
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
        <h2 className="integration-card__name">Channex</h2>
        <p className="integration-card__kind">Менеджер каналов</p>
      </div>
      <Badge tone={HEALTH_TONE[health]} data-testid="integration-health">
        {HEALTH_LABEL[health]}
      </Badge>
    </header>
  );
}

const ABOUT = 'Цены, остатки, ограничения и брони из Booking.com, Trip.com и других каналов.';
const CONTENT_NOTE =
  'Фото, удобства и описание для каналов настраиваются в кабинете Channex или самого канала.';

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
      <p className="integration-card__about">{ABOUT}</p>
      {card.issues.length > 0 && (
        <ul className="integration-card__issues" data-testid="integration-issues">
          {card.issues.map((issue) => (
            <li key={issue.text}>
              <span>{issue.text}</span>
              {issue.href && issue.action && <Link href={issue.href}>{issue.action}</Link>}
            </li>
          ))}
        </ul>
      )}
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
              {pluralRu(c.mappedRatePlans, ['тариф', 'тарифа', 'тарифов'])}
            </dd>
          </div>
        )}
      </dl>
      <div className="integration-card__actions">
        <RefreshButton label="Проверить соединение" />
        <Link className="btn btn--secondary" href="/channels/connections#channel-setup">
          Настройки
        </Link>
        <Link className="btn btn--ghost" href="/channels">
          Каналы продаж
        </Link>
      </div>
      {technical && (
        <details className="integration-card__tech" data-testid="integration-tech">
          <summary>Технические детали</summary>
          <dl className="integration-card__facts">
            <div>
              <dt>Среда Channex</dt>
              <dd>
                {!c
                  ? '—'
                  : c.environment === 'production'
                    ? 'Рабочая'
                    : c.environment === 'staging'
                      ? 'Тестовая'
                      : 'Свой сервер'}
              </dd>
            </div>
            <div>
              <dt>Объект в Channex</dt>
              <dd className="integration-card__code">{c?.propertyId ?? '—'}</dd>
            </div>
            <div>
              <dt>Webhook</dt>
              <dd>
                {!card.webhook
                  ? '—'
                  : card.webhook.registered && card.webhook.active
                    ? 'включён'
                    : 'не включён'}
              </dd>
            </div>
            <div>
              <dt>Последний webhook</dt>
              <dd>{clock.full(c?.lastWebhookAt)}</dd>
            </div>
            <div>
              <dt>Последний импорт</dt>
              <dd>{clock.full(c?.lastPullAt)}</dd>
            </div>
            <div>
              <dt>Проверено</dt>
              <dd>{clock.full(c?.checkedAt)}</dd>
            </div>
          </dl>
        </details>
      )}
      <p className="note" data-testid="channel-content-location">
        {CONTENT_NOTE}
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
      <p className="integration-card__about">{ABOUT}</p>
      <p className="integration-card__how" data-testid="integration-connect">
        {readOnly
          ? 'Подключение — после оплаты подписки. Данные доступны для просмотра.'
          : 'Подключает поддержка WETOP: ключ хранится на сервере и в интерфейс не вводится. Напишите в чат помощника справа внизу.'}
      </p>
      <p className="note" data-testid="channel-content-location">
        {CONTENT_NOTE}
      </p>
    </Panel>
  );
}
