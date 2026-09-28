import Link from 'next/link';
import { Page } from '../../../components/page';
import { RefreshButton } from '../../../components/refresh-button';
import { Badge, Panel } from '../../../components/ui';
import { pluralRu } from '../../../lib/plural';
import { exchangeLine } from '../../../lib/integrations';
import { loadChannexState } from '../connection-state';
import {
  CHANNEX_ABOUT,
  CHANNEX_CONTENT_NOTE,
  CHANNEX_READ_ONLY,
  CHANNEX_SUPPORT,
  HealthBadge,
  IssueList,
  TechDetails,
} from '../connection-parts';
import '../integrations.css';

/**
 * «Интеграции → Channex», срез INT2 (ADR-121, план `plans/integrations-int2-2026-09-28.md`): подключено ли соединение
 * и как им управлять. Очередь, брони из каналов, сопоставления, события и массовая выгрузка — в «Каналах продаж»,
 * сюда не переносятся. Переподключить и отключить API не умеет: кнопок нет, путь — через поддержку WETOP. Ключ,
 * секрет и адрес webhook не показываются. Изменений на странице нет — «только чтение» ничего не прячет.
 */
export default async function ChannexPage() {
  const { card, coverage, propertyName, clock, now, technical, owner, readOnly } =
    await loadChannexState();
  const c = card.connection;
  const w = card.webhook;
  const off = card.health === 'off';
  return (
    <Page
      title="Channex"
      crumbs={<Link href="/connections">Интеграции</Link>}
      subtitle={
        <span className="integration-subtitle">
          <HealthBadge health={card.health} />
          <span>
            Менеджер каналов{propertyName ? ` для ${propertyName}` : ''}. {CHANNEX_ABOUT}
          </span>
        </span>
      }
    >
      {off ? (
        <Panel className="integration-card" data-testid="channex-not-connected">
          <h2 className="integration-card__name">Channex не подключён</h2>
          <p className="integration-card__how" data-testid="integration-connect">
            {readOnly ? CHANNEX_READ_ONLY : CHANNEX_SUPPORT}
          </p>
          <p className="note">{CHANNEX_CONTENT_NOTE}</p>
        </Panel>
      ) : (
        <div className="stack" data-testid="channex-settings">
          <IssueList issues={card.issues} />
          <div className="integration-detail">
            <Panel className="integration-card" title="Соединение" data-testid="channex-connection">
              <dl className="integration-card__facts">
                <div>
                  <dt>Объект</dt>
                  <dd>{propertyName ?? '—'}</dd>
                </div>
                <div>
                  <dt>Ключ доступа</dt>
                  <dd>
                    {!c ? '—' : c.apiConfigured ? 'задан, хранится на сервере WETOP' : 'не задан'}
                  </dd>
                </div>
                <div>
                  <dt>Проверка</dt>
                  <dd data-testid="channex-check">
                    {!c ? (
                      'не удалась'
                    ) : c.state === 'READY' ? (
                      <>
                        прошла в <time dateTime={c.checkedAt}>{clock.clock(c.checkedAt)}</time>
                      </>
                    ) : (
                      `не прошла: ${c.message.toLocaleLowerCase('ru')}`
                    )}
                  </dd>
                </div>
              </dl>
            </Panel>
            <Panel className="integration-card" title="Состояние" data-testid="channex-state">
              <dl className="integration-card__facts">
                <div>
                  <dt>Webhook</dt>
                  <dd data-testid="channex-webhook">
                    {!w ? (
                      'не проверен'
                    ) : !w.registered || !w.active ? (
                      <Badge tone="warn">не включён</Badge>
                    ) : w.callbackReachable === false ? (
                      <Badge tone="warn">не отвечает</Badge>
                    ) : w.callbackReachable === true ? (
                      <Badge tone="ok">включён и отвечает</Badge>
                    ) : (
                      <Badge tone="ok">включён</Badge>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Категории</dt>
                  <dd data-testid="channex-categories">
                    {coverage ? (
                      <>
                        <Badge tone={coverage.mapped === coverage.total ? 'ok' : 'warn'}>
                          {coverage.mapped} из {coverage.total}
                        </Badge>
                        {coverage.missing.length > 0 && (
                          <span className="integration-card__missing">
                            не сопоставлены: {coverage.missing.join(', ')}
                          </span>
                        )}
                      </>
                    ) : c ? (
                      pluralRu(c.mappedCategories, ['категория', 'категории', 'категорий'])
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Тарифы</dt>
                  <dd>{c ? `сопоставлено ${c.mappedRatePlans}` : '—'}</dd>
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
              </dl>
            </Panel>
          </div>
          <div className="integration-card__actions">
            <RefreshButton label="Проверить соединение" />
            <Link className="btn btn--secondary" href="/channels">
              Каналы продаж
            </Link>
          </div>
          <Panel
            className="integration-card"
            title="Управление подключением"
            data-testid="channex-manage"
          >
            <p className="integration-card__how">
              Переподключить, сменить ключ или отключить Channex может поддержка WETOP: ключ хранится на
              сервере, в интерфейсе его нет. Напишите в чат помощника справа внизу.
            </p>
            {owner && !readOnly && (
              <p className="integration-card__how">
                Webhook и объект в Channex владелец настраивает в{' '}
                <Link href="/channels/connections">«Каналах продаж», на вкладке «Подключения»</Link>.
              </p>
            )}
            {readOnly && (
              <p className="integration-card__how" data-testid="channex-read-only">
                Изменения подключения — после оплаты подписки. Проверка соединения доступна.
              </p>
            )}
          </Panel>
          {technical && <TechDetails card={card} clock={clock} />}
          <p className="note">{CHANNEX_CONTENT_NOTE}</p>
        </div>
      )}
    </Page>
  );
}
