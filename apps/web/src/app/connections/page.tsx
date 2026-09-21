import Link from 'next/link';
import { analyticsApi, channelsApi } from '../../lib/api';
import { Page } from '../../components/page';
import { RefreshButton } from '../../components/refresh-button';
import { Alert, Badge, Fact, Grid, Help, Panel } from '../../components/ui';
import { hotelApi } from '../../lib/hotel-api';
import { pluralRu } from '../../lib/plural';
import { DataConnectionPanel } from './data-connection';

/** Время события по часам объекта; событий не было — «—» (§14), а не фраза вместо значения */
const time = (value: string | null) =>
  value ? new Date(value).toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' }) : '—';

export default async function ConnectionsPage() {
  const [connection, webhook, sites, database] = await Promise.allSettled([
    channelsApi.connection(),
    channelsApi.webhookStatus(),
    analyticsApi.sites(),
    hotelApi.connection(),
  ]);
  const status = connection.status === 'fulfilled' ? connection.value : null;
  return (
    <Page
      title="Интеграции"
      subtitle="Подключения гостиницы и состояние обмена данными."
      actions={<RefreshButton label="Проверить соединение" />}
    >
      <div className="settings-connections">
        <DataConnectionPanel connection={database.status === 'fulfilled' ? database.value : null} />
        {!status && <Alert boxed>Не удалось проверить подключение Channex.</Alert>}
        <div className="connection-grid">
          <Panel title="Channex" id="channex-connection">
            <Badge tone={status?.propertyAccessible ? 'ok' : 'warn'}>
              {status?.message ?? 'Не проверено'}
            </Badge>
            {status && (
              <Grid min={180}>
                <Fact
                  label="Среда"
                  value={
                    status.environment === 'production'
                      ? 'Рабочая'
                      : status.environment === 'staging'
                        ? 'Тестовая'
                        : 'Свой сервер'
                  }
                />
                <Fact
                  label="Сопоставлено"
                  value={`${pluralRu(status.mappedCategories, ['категория', 'категории', 'категорий'])}, ${pluralRu(status.mappedRatePlans, ['тариф', 'тарифа', 'тарифов'])}`}
                />
                <Fact label="Последний webhook, по Алматы" value={time(status.lastWebhookAt)} />
                <Fact label="Последний импорт, по Алматы" value={time(status.lastPullAt)} />
              </Grid>
            )}
            {webhook.status === 'fulfilled' ? (
              <Badge tone={webhook.value.registered && webhook.value.active ? 'ok' : 'warn'}>
                {webhook.value.registered && webhook.value.active
                  ? 'Webhook включён'
                  : 'Webhook не включён'}
              </Badge>
            ) : (
              <Alert>Не удалось проверить webhook.</Alert>
            )}
            <Link className="btn btn--secondary" href="/channels">
              Настроить Channex
            </Link>
            <p className="note" data-testid="channel-content-location">
              Фото, удобства и описание для каналов настраиваются в кабинете Channex или самого
              канала.
            </p>
          </Panel>
          <Panel title="Сайт и бронирования">
            {sites.status === 'fulfilled' ? (
              <>
                <Badge tone={sites.value.length ? 'ok' : 'neutral'}>
                  Сайтов в системе: {sites.value.length}
                </Badge>
                <Fact
                  label="Виджет включён"
                  value={sites.value.filter((site) => site.bookingEnabled).length}
                />
              </>
            ) : (
              <Alert>Не удалось загрузить сайты.</Alert>
            )}
            <Link className="btn btn--secondary" href="/analytics/setup">
              Настроить сайт
            </Link>
          </Panel>
        </div>
        <Help title="Что требуется для подключения">
          <p>
            Рабочий API с базой данных, ключ Channex, сопоставления объекта, категорий и тарифов,
            входящий webhook. Ключ хранится только на сервере.
          </p>
          <p>
            Проверка соединения читает объект в Channex. Она не запускает импорт броней и отправку
            тарифов. Время событий показывает поступление данных в PMS.
          </p>
          <Link href="/incidents">Проверить неисправности</Link>
        </Help>
      </div>
    </Page>
  );
}
