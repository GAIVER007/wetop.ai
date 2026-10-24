import type { DataConnection } from '@pms/shared';
import { Alert, Badge, Fact, Grid, Panel } from '../../components/ui';
import { FALLBACK_TIMEZONE, propertyClock } from '../../lib/property-time';
import { serverT } from '../../i18n/server';

export async function DataConnectionPanel({ connection }: { connection: DataConnection | null }) {
  const source = connection?.source;
  const ready = connection?.state === 'READY';
  const t = await serverT();
  return (
    <Panel title={t('Данные проекта')} data-testid="data-connection">
      {!connection ? (
        <Alert>{t('Нет связи с рабочим API. Данные проекта не загружены.')}</Alert>
      ) : (
        <>
          <div className="row">
            <Badge tone={source === 'database' && ready ? 'ok' : 'warn'}>
              {source === 'demo'
                ? t('Демонстрационные данные')
                : source === 'synthetic'
                  ? t('Тестовые данные')
                  : t('База проекта')}
            </Badge>
            {source === 'database' && (
              <Badge tone={connection.database.connected ? 'ok' : 'warn'}>
                {connection.database.connected
                  ? t('{db} подключён', { db: connection.database.provider === 'supabase' ? 'Supabase' : 'PostgreSQL' })
                  : t('{db} недоступен', { db: connection.database.provider === 'supabase' ? 'Supabase' : 'PostgreSQL' })}
              </Badge>
            )}
          </div>
          {!ready && <Alert>{connection.message}</Alert>}
          {source !== 'database' && <p className="note">{t('Этот источник не подключён к Supabase.')}</p>}
          {ready && connection.property && connection.counts && (
            <>
              <Grid min={180}>
                <Fact label={t('Гостиница')} value={connection.property.name} />
                <Fact label={t('Часовой пояс')} value={connection.property.timezone} />
                <Fact label={t('Валюта')} value={connection.property.currency} />
              </Grid>
              <Grid min={140}>
                <Fact
                  label={t('Номера и койко-места')}
                  value={<span data-testid="database-units">{connection.counts.units}</span>}
                />
                <Fact label={t('Категории')} value={connection.counts.categories} />
                <Fact label={t('Бронирования')} value={connection.counts.reservations} />
                <Fact label={t('Тарифы')} value={connection.counts.ratePlans} />
                <Fact label={t('Услуги')} value={connection.counts.services} />
                <Fact label={t('Сайты')} value={connection.counts.sites} />
              </Grid>
            </>
          )}
          <p className="note">
            {t('Проверено:')}{' '}
            {propertyClock(connection.property?.timezone ?? FALLBACK_TIMEZONE).local(
              connection.checkedAt,
            )}
          </p>
        </>
      )}
    </Panel>
  );
}
