import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { channelsApi, type ChannelCatalog } from '../../lib/api';
import { hotelClock } from '../../lib/hotel-api';
import { currentMe, deskShell } from '../../lib/desk-shell';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { Alert, Badge, EmptyState, Input, SectionTitle, Table } from '../../components/ui';
import { ChannelRowActions, ConnectChannelButton } from './channel-connect';
import { channelStatusView, matchesChannel, outsideLabel } from './channel-list-format';

/**
 * Раздел «Каналы» (ADR-138, план plans/channels-catalog-2026-10-03.md): как привыкли в прежней системе —
 * «Подключённые N» и «Все доступные каналы», таблица с колонками «Канал», «ID в канале», «Название подключения»,
 * «Брони за 30 дней», «Статус», «Действие». Подключения и каталог — из Channex, брони — из WETOP. Подключает, сопоставляет и включает канал
 * владелец в окне Channex; остальные видят список.
 */
export async function ChannelList({ sp }: { sp: Record<string, string | undefined> }) {
  const view = sp.view === 'available' ? 'available' : 'connected';
  const q = (sp.q ?? '').slice(0, 80);
  const [loaded, clock, me, shell] = await Promise.all([
    channelsApi.catalog().then(
      (r) => ({ ok: true as const, r }),
      (e: unknown) => {
        unstable_rethrow(e);
        return { ok: false as const, e };
      },
    ),
    hotelClock(),
    currentMe().catch(() => null),
    deskShell(),
  ]);
  if (!loaded.ok) return <LoadError testId="channel-list-error" {...loadErrorProps(loaded.e)} />;
  const data: ChannelCatalog = loaded.r;
  const canManage =
    !shell.readOnly &&
    me?.user?.role === 'OWNER' &&
    data.state === 'READY' &&
    data.propertyConnected;
  const connections = data.connections.filter((c) => matchesChannel(c, q));
  const adapters = (data.adapters ?? []).filter((a) =>
    a.title.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const href = (v: 'connected' | 'available') =>
    `/channels/list${v === 'available' ? '?view=available' : ''}`;
  return (
    <div className="stack channel-list" data-testid="channel-list">
      {data.state !== 'READY' && (
        <Alert boxed data-testid="channel-list-state">
          {data.message}.{' '}
          {data.state === 'NO_MAPPING' || data.state === 'NO_KEY' ? (
            <Link href="/connections/channex">Настроить подключение</Link>
          ) : (
            'Обновите страницу позже.'
          )}
        </Alert>
      )}
      {data.environment === 'staging' && data.state === 'READY' && (
        <p className="note" data-testid="channel-list-staging">
          Тестовый контур менеджера каналов: каналы здесь тестовые, настоящие брони через них не
          приходят.
        </p>
      )}
      <div className="channel-list__bar">
        <nav className="channel-list__tabs" aria-label="Каналы">
          <Link href={href('connected')} aria-current={view === 'connected' ? 'page' : undefined}>
            Подключённые <span className="channel-list__count">{data.connections.length}</span>
          </Link>
          <Link href={href('available')} aria-current={view === 'available' ? 'page' : undefined}>
            Все доступные каналы
            {data.adapters && <span className="channel-list__count">{data.adapters.length}</span>}
          </Link>
        </nav>
        {canManage && <ConnectChannelButton label="Подключить новый канал" />}
      </div>
      <form className="channel-list__search" role="search" action="/channels/list">
        {view === 'available' && <input type="hidden" name="view" value="available" />}
        <Input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={view === 'available' ? 'Найти канал' : 'Канал или ID в канале'}
          aria-label="Найти канал"
        />
      </form>
      {view === 'connected' ? (
        <section className="stack stack--sm" aria-labelledby="connected-title">
          <SectionTitle id="connected-title">Подключённые каналы</SectionTitle>
          {data.connections.length === 0 ? (
            <EmptyState
              title={data.state === 'READY' ? 'Каналов пока нет' : 'Список каналов не загрузился'}
              data-testid="channel-list-empty"
            >
              {data.state === 'READY'
                ? canManage
                  ? 'Нажмите «Подключить новый канал»: Booking.com, Agoda, Expedia и другие подключаются в окне менеджера каналов.'
                  : 'Каналы подключает владелец объекта.'
                : 'Брони из WETOP ниже видны и без менеджера каналов.'}
            </EmptyState>
          ) : connections.length === 0 ? (
            <p className="note">По запросу «{q}» каналов нет.</p>
          ) : (
            <Table
              size="sm"
              className="dir-table channel-table channel-table--connections"
              data-testid="channel-connections"
              aria-label="Таблица подключённых каналов"
            >
              <thead>
                <tr>
                  <th>Канал</th>
                  <th>ID в канале</th>
                  <th>Название подключения</th>
                  <th className="num">Брони за 30 дней</th>
                  <th>Статус</th>
                  <th className="channel-list__actions">Действие</th>
                </tr>
              </thead>
              <tbody>
                {connections.map((c) => {
                  const s = channelStatusView(c);
                  return (
                    <tr key={c.id} data-testid="channel-row">
                      <td>
                        <strong>{c.channelTitle}</strong>
                      </td>
                      <td className="nowrap">{c.channelPropertyId ?? '—'}</td>
                      <td>{c.connectionTitle || '—'}</td>
                      <td className="num">
                        {c.bookings30 > 0 ? c.bookings30 : '—'}
                        {c.lastBookingAt && (
                          <span className="channel-list__sub">
                            последняя {clock.moment(c.lastBookingAt)}
                          </span>
                        )}
                      </td>
                      <td>
                        <Badge tone={s.tone} data-testid="channel-status">
                          {s.label}
                        </Badge>
                        {s.note &&
                          (c.status === 'ERRORS' ? (
                            <Link
                              href="/channels/events?status=FAILED"
                              className="channel-list__sub danger-text"
                            >
                              {s.note}
                            </Link>
                          ) : (
                            <span className="channel-list__sub">{s.note}</span>
                          ))}
                      </td>
                      <td className="channel-list__actions">
                        <ChannelRowActions
                          title={c.channelTitle}
                          bookingsHref={`/reservations?source=${encodeURIComponent(c.channelTitle)}`}
                          channel={c.shortCode ?? undefined}
                          canManage={canManage}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
          {data.outside.length > 0 && (
            <section
              className="stack stack--sm"
              aria-labelledby="outside-title"
              data-testid="channel-outside"
            >
              <SectionTitle id="outside-title">Брони мимо подключений за 30 дней</SectionTitle>
              <p className="note">
                Источники, у которых нет подключения в менеджере каналов: стойка, сайт, телефон и
                каналы, внесённые вручную.
              </p>
              <Table size="sm" className="dir-table" aria-label="Таблица броней мимо подключений">
                <thead>
                  <tr>
                    <th>Источник</th>
                    <th className="num">Брони за 30 дней</th>
                    <th>Последняя</th>
                  </tr>
                </thead>
                <tbody>
                  {data.outside.map((o) => (
                    <tr key={o.key} data-testid="channel-outside-row">
                      <td>{outsideLabel(o)}</td>
                      <td className="num">{o.bookings30}</td>
                      <td className="nowrap">
                        {o.lastBookingAt ? clock.moment(o.lastBookingAt) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </section>
          )}
        </section>
      ) : (
        <section className="stack stack--sm" aria-labelledby="available-title">
          <SectionTitle id="available-title">Все доступные каналы</SectionTitle>
          <p className="note">
            Каналы, которые поддерживает менеджер каналов. Список обновляется раз в сутки.
          </p>
          {!data.adapters ? (
            <p className="note" data-testid="channel-adapters-missing">
              Список каналов приходит из менеджера каналов: {data.message.toLowerCase()}.
            </p>
          ) : adapters.length === 0 ? (
            <p className="note">По запросу «{q}» каналов нет.</p>
          ) : (
            <Table
              size="sm"
              className="dir-table channel-table"
              data-testid="channel-adapters"
              aria-label="Таблица доступных каналов"
            >
              <thead>
                <tr>
                  <th>Канал</th>
                  <th>Подключение</th>
                </tr>
              </thead>
              <tbody>
                {adapters.map((a) => (
                  <tr key={a.code} data-testid="channel-adapter-row">
                    <td>
                      <strong>{a.title}</strong>
                    </td>
                    <td>
                      {a.connected ? (
                        <Badge tone="ok">Подключён</Badge>
                      ) : canManage ? (
                        <ConnectChannelButton
                          channel={a.shortCode ?? undefined}
                          label="Подключить"
                          tone="secondary"
                          testId="channel-adapter-connect"
                        />
                      ) : (
                        <span className="muted">не подключён</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </section>
      )}
    </div>
  );
}
