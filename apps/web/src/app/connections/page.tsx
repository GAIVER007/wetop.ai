import Link from 'next/link';
import { analyticsApi, channelsApi } from '../../lib/api';
import { Page } from '../../components/page';
import { Alert, Badge, Panel } from '../../components/ui';

export default async function ConnectionsPage() {
  // Independent integrations fail independently: no false "disconnected" state on an API error.
  const [webhook, mapping, sites] = await Promise.allSettled([
    channelsApi.webhookStatus(),
    channelsApi.mapping(),
    analyticsApi.sites(),
  ]);
  return (
    <Page title="Подключения API" subtitle="Каналы продаж, сайт и модуль прямого бронирования.">
      <div className="connection-grid">
        <Panel title="Channex · каналы продаж">
          {webhook.status === 'fulfilled' ? (
            <Badge tone={webhook.value.registered && webhook.value.active ? 'ok' : 'warn'}>
              {webhook.value.registered && webhook.value.active
                ? 'Webhook зарегистрирован и включён'
                : 'Webhook не включён'}
            </Badge>
          ) : (
            <Alert>Не удалось проверить webhook.</Alert>
          )}
          <p>Получение бронирований из OTA и обмен доступностью, ценами и ограничениями.</p>
          {mapping.status === 'fulfilled' ? (
            <p className="note">Сопоставлений с объектом: {mapping.value.length}</p>
          ) : (
            <Alert>Не удалось загрузить сопоставления.</Alert>
          )}
          <Link className="btn btn--secondary" href="/channels">
            Управлять подключением
          </Link>
        </Panel>
        <Panel title="Сайт и модуль бронирования">
          {sites.status === 'fulfilled' ? (
            <Badge tone={sites.value.length ? 'ok' : 'neutral'}>
              Сайтов в системе: {sites.value.length}
            </Badge>
          ) : (
            <Alert>Не удалось загрузить сайты.</Alert>
          )}
          <p>Подключение счётчика, разрешённых доменов и виджета прямого бронирования.</p>
          <Link className="btn btn--secondary" href="/analytics/setup">
            Настроить сайт
          </Link>
        </Panel>
        <Panel title="Другие API">
          <Badge>Ещё не подключено</Badge>
          <p>
            Самостоятельное добавление произвольного API, выдача ключей и настройка новых
            провайдеров пока недоступны.
          </p>
          <Link href="/incidents">Проверить неисправности системы</Link>
        </Panel>
      </div>
      <p className="note">
        Статус регистрации webhook показывает конфигурацию. Доставку событий и ошибки синхронизации
        проверяйте в журнале канала.
      </p>
    </Page>
  );
}
