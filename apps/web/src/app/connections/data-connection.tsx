import type { DataConnection } from '@pms/shared';
import { Alert, Badge, Fact, Grid, Panel } from '../../components/ui';

export function DataConnectionPanel({ connection }: { connection: DataConnection | null }) {
  const source = connection?.source;
  const ready = connection?.state === 'READY';
  return (
    <Panel title="Данные проекта" data-testid="data-connection">
      {!connection ? (
        <Alert>Нет связи с backend. Данные проекта не загружены.</Alert>
      ) : (
        <>
          <div className="row">
            <Badge tone={source === 'database' && ready ? 'ok' : 'warn'}>
              {source === 'demo'
                ? 'Демонстрационные данные'
                : source === 'synthetic'
                  ? 'Тестовые данные'
                  : 'База проекта'}
            </Badge>
            {source === 'database' && (
              <Badge tone={connection.database.connected ? 'ok' : 'warn'}>
                {connection.database.provider === 'supabase' ? 'Supabase' : 'PostgreSQL'}
                {connection.database.connected ? ' подключён' : ' недоступен'}
              </Badge>
            )}
          </div>
          {!ready && <Alert>{connection.message}</Alert>}
          {source !== 'database' && <p className="note">Этот источник не подключён к Supabase.</p>}
          {ready && connection.property && connection.counts && (
            <>
              <Grid min={180}>
                <Fact label="Гостиница" value={connection.property.name} />
                <Fact label="Часовой пояс" value={connection.property.timezone} />
                <Fact label="Валюта" value={connection.property.currency} />
              </Grid>
              <Grid min={140}>
                <Fact
                  label="Номера и койко-места"
                  value={<span data-testid="database-units">{connection.counts.units}</span>}
                />
                <Fact label="Категории" value={connection.counts.categories} />
                <Fact label="Бронирования" value={connection.counts.reservations} />
                <Fact label="Тарифы" value={connection.counts.ratePlans} />
                <Fact label="Услуги" value={connection.counts.services} />
                <Fact label="Сайты" value={connection.counts.sites} />
              </Grid>
            </>
          )}
          <p className="note">
            Проверено:{' '}
            {new Date(connection.checkedAt).toLocaleString('ru-RU', {
              timeZone: connection.property?.timezone ?? 'Asia/Almaty',
            })}
          </p>
        </>
      )}
    </Panel>
  );
}
