import Link from 'next/link';
import { channelsApi } from '../../lib/api';
import { hotelClock } from '../../lib/hotel-api';
import { currentMe } from '../../lib/desk-shell';
import type { PropertyClock } from '../../lib/property-time';
import { Alert, Badge, Panel, Grid, Fact } from '../../components/ui';
import { ChannelButtons } from './buttons';
import './channels.css';
const settle = <T,>(p: Promise<T>) =>
  p.then(
    (r) => ({ ok: true as const, r }),
    (e) => ({ ok: false as const, e }),
  );
const checkedAt = (iso: string | null | undefined, clock: PropertyClock) =>
  iso ? `, проверено ${clock.clock(iso)} по Алматы` : '';
export async function ChannelConnectionSetup() {
  const clock = await hotelClock();
  const [connection, webhook, me] = await Promise.all([
    channelsApi.connection().catch(() => null),
    channelsApi.webhookStatus().catch(() => null),
    settle(currentMe()),
  ]);
  const owner = me.ok && me.r.user?.role === 'OWNER';
  const webhookReady = !!webhook?.expectedUrl && !!webhook?.secretConfigured;
  return (
    <div className="stack">
      {!connection && <Alert boxed>Не удалось проверить подключение менеджера каналов.</Alert>}
      <Panel title="Менеджер каналов" data-testid="channel-connection">
        <Badge tone={connection?.propertyAccessible ? 'ok' : 'warn'}>
          {connection?.message ?? 'Не проверено'}
        </Badge>
        {connection && (
          <Grid min={180}>
            <Fact
              label="Среда"
              value={
                connection.environment === 'production'
                  ? 'Рабочая'
                  : connection.environment === 'staging'
                    ? 'Тестовая'
                    : 'Свой сервер'
              }
            />
            <Fact
              label="Объект в менеджере каналов"
              value={
                connection.propertyId ? (
                  <span className="mono break-all">{connection.propertyId}</span>
                ) : (
                  'не создан'
                )
              }
            />
            <Fact
              label="Сопоставлено"
              value={`категорий ${connection.mappedCategories}, тарифов ${connection.mappedRatePlans}`}
            />
            <Fact
              label="Последний webhook, по Алматы"
              value={clock.local(connection.lastWebhookAt)}
            />
            <Fact label="Последний импорт, по Алматы" value={clock.local(connection.lastPullAt)} />
          </Grid>
        )}
      </Panel>
      <Panel title="Webhook менеджера каналов" data-testid="channel-webhook">
        {webhook === null ? (
          <Alert>
            Статус webhook не загрузился. Его состояние неизвестно — обновите страницу перед
            настройкой.
          </Alert>
        ) : (
          <>
            <Badge tone={webhook.registered && webhook.active ? 'ok' : 'warn'}>
              <span data-testid="webhook-state">
                {webhook.registered
                  ? `${webhook.active ? 'активен' : 'выключен'}, события ${webhook.eventMask}`
                  : webhook.expectedUrl
                    ? 'не зарегистрирован'
                    : 'нет PUBLIC_API_URL'}
              </span>
            </Badge>
            {webhook.registered && <p className="note break-all">{webhook.callbackUrl}</p>}
            {webhook.registered &&
              webhook.expectedUrl &&
              webhook.callbackUrl !== webhook.expectedUrl && (
                <p className="note danger-text" data-testid="webhook-url-mismatch">
                  зарегистрирован не постоянный адрес PMS ({webhook.expectedUrl}) — события уходят
                  не туда, нажмите «Зарегистрировать webhook»
                </p>
              )}
            {webhook.registered &&
              webhook.callbackReachable === false &&
              (!webhook.expectedUrl || webhook.callbackUrl === webhook.expectedUrl) && (
                <p className="note danger-text">
                  адрес не отвечает{checkedAt(webhook.callbackCheckedAt, clock)} — брони подберёт
                  опрос ленты, но webhook надо поднять
                </p>
              )}
            {webhook.registered && webhook.callbackReachable === true && (
              <p className="note ok-text">
                адрес отвечает{checkedAt(webhook.callbackCheckedAt, clock)}
              </p>
            )}
          </>
        )}
      </Panel>
      {owner ? (
        <ChannelButtons
          group="setup"
          webhookReady={webhookReady}
          configured={!!connection?.apiConfigured}
          connected={!!connection?.propertyAccessible}
        />
      ) : (
        <p className="note" data-testid="channel-setup-owner-only">
          Настройку подключения меняет владелец организации.
        </p>
      )}
      <p className="note" data-testid="channel-content-location">
        Ключ менеджера каналов хранится только на сервере. Общий экран подключений гостиницы —{' '}
        <Link href="/connections">«Подключения»</Link>; фото, удобства и описание для каналов
        настраиваются в кабинете менеджера каналов или самого канала.
      </p>
    </div>
  );
}
