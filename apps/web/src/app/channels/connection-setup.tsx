import Link from 'next/link';
import { channelsApi } from '../../lib/api';
import { hotelApi, hotelClock } from '../../lib/hotel-api';
import { currentMe, deskShell } from '../../lib/desk-shell';
import { mayAccess } from '../../lib/navigation';
import type { PropertyClock } from '../../lib/property-time';
import { Alert, Badge, Panel, Grid, Fact } from '../../components/ui';
import { ChannelButtons } from './buttons';
import { unstable_rethrow } from 'next/navigation';
import { serverT } from '../../i18n/server';
import { msg, type Translate } from '../../i18n';
import './channels.css';
const settle = <T,>(p: Promise<T>) =>
  p.then(
    (r) => ({ ok: true as const, r }),
    (e: unknown) => {
      unstable_rethrow(e);
      return { ok: false as const, e };
    },
  );
const checkedAt = (iso: string | null | undefined, clock: PropertyClock, t: Translate) =>
  iso ? t(', проверено {time} по времени объекта', { time: clock.clock(iso) }) : '';
export async function ChannelConnectionSetup({ canMutate }: { canMutate?: boolean } = {}) {
  const clock = await hotelClock();
  const t = await serverT();
  const [connection, webhook, me, hotel, shell] = await Promise.all([
    channelsApi.connection().catch(() => null),
    channelsApi.webhookStatus().catch(() => null),
    settle(currentMe()),
    hotelApi.settings().catch(() => null),
    deskShell(),
  ]);
  const mutationAllowed =
    (canMutate ?? mayAccess(shell.access, 'channels')) && !shell.readOnly;
  const owner = me.ok && me.r.user?.role === 'OWNER';
  const webhookReady = !!webhook?.expectedUrl && !!webhook?.secretConfigured;
  return (
    <div className="stack">
      {!connection && <Alert boxed>{t('Не удалось проверить подключение менеджера каналов.')}</Alert>}
      <Panel title={t('Менеджер каналов')} data-testid="channel-connection">
        <Badge tone={connection?.propertyAccessible ? 'ok' : 'warn'}>
          {connection?.message ?? t('Не проверено')}
        </Badge>
        {connection && (
          <Grid min={180}>
            <Fact
              label={t('Контур')}
              value={
                connection.environment === 'production'
                  ? t('Рабочая')
                  : connection.environment === 'staging'
                    ? t('Тестовая')
                    : t('Свой сервер')
              }
            />
            <Fact
              label={t('Объект в менеджере каналов')}
              value={
                connection.propertyId ? (
                  <span className="mono break-all">{connection.propertyId}</span>
                ) : (
                  t('не создан')
                )
              }
            />
            <Fact
              label={t('Сопоставлено')}
              value={t('категорий {categories}, тарифных планов {plans}, сопоставлений {mappings}', {
                categories: connection.mappedCategories,
                plans: connection.mappedLocalRatePlans,
                mappings: connection.mappedRatePlans,
              })}
            />
            <Fact
              label={t('Последний webhook, время объекта')}
              value={clock.local(connection.lastWebhookAt)}
            />
            <Fact label={t('Последний импорт, время объекта')} value={clock.local(connection.lastPullAt)} />
          </Grid>
        )}
      </Panel>
      <Panel title={t('Webhook менеджера каналов')} data-testid="channel-webhook">
        {webhook === null ? (
          <Alert>
            {t('Статус webhook не загрузился. Его состояние неизвестно, обновите страницу перед настройкой.')}
          </Alert>
        ) : (
          <>
            <Badge tone={webhook.registered && webhook.active ? 'ok' : 'warn'}>
              <span data-testid="webhook-state">
                {webhook.registered
                  ? t(webhook.active ? msg('активен, события {mask}') : msg('выключен, события {mask}'), {
                      // как до перевода: шаблон печатал маску как есть, `null` словом
                      mask: String(webhook.eventMask),
                    })
                  : webhook.expectedUrl
                    ? t('не зарегистрирован')
                    : t('нет PUBLIC_API_URL')}
              </span>
            </Badge>
            {webhook.registered && <p className="note break-all">{webhook.callbackUrl}</p>}
            {webhook.registered &&
              webhook.expectedUrl &&
              webhook.callbackUrl !== webhook.expectedUrl && (
                <p className="note danger-text" data-testid="webhook-url-mismatch">
                  {t('зарегистрирован не постоянный адрес PMS ({url}): события уходят не туда, нажмите «Зарегистрировать webhook»', {
                    url: webhook.expectedUrl,
                  })}
                </p>
              )}
            {webhook.registered &&
              webhook.callbackReachable === false &&
              (!webhook.expectedUrl || webhook.callbackUrl === webhook.expectedUrl) && (
                <p className="note danger-text">
                  {t('адрес не отвечает{checked}: брони подберёт опрос ленты, но webhook надо поднять', {
                    checked: checkedAt(webhook.callbackCheckedAt, clock, t),
                  })}
                </p>
              )}
            {webhook.registered && webhook.callbackReachable === true && (
              <p className="note ok-text">
                {t('адрес отвечает{checked}', { checked: checkedAt(webhook.callbackCheckedAt, clock, t) })}
              </p>
            )}
          </>
        )}
      </Panel>
      {owner && mutationAllowed ? (
        <ChannelButtons
          group="setup"
          webhookReady={webhookReady}
          configured={!!connection?.apiConfigured}
          connected={!!connection?.propertyAccessible}
          ratePlans={
            hotel?.ratePlans
              .filter((plan) => plan.active)
              .map((plan) => ({ code: plan.code, name: plan.name })) ?? []
          }
          canMutate
        />
      ) : (
        <p className="note" data-testid="channel-setup-owner-only">
          {t('Настройку подключения меняет владелец организации.')}
        </p>
      )}
      <p className="note" data-testid="channel-content-location">
        {t('Ключ менеджера каналов хранится только на сервере. Общий экран подключений гостиницы:')}{' '}
        <Link href="/connections">«{t('Подключения')}»</Link>
        {t('; фото, удобства и описание для каналов настраиваются в кабинете менеджера каналов или самого канала.')}
      </p>
    </div>
  );
}
