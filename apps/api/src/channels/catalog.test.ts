import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { channex } from '@pms/integrations';
import { ChannelCatalogService, channelStatus, type ChannelActivity } from './catalog';

afterEach(() => vi.unstubAllEnvs());
const NOW = new Date('2026-10-03T10:00:00Z');
const day = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const booking: channex.ChannexChannelAdapter = {
  code: 'BookingCom',
  title: 'Booking.com',
  kind: 'meta',
  params: { hotel_id: { position: 0, type: 'string' } },
  actions: ['load_future_reservations'],
  mapping_mode: null,
  message_support: true,
  property_mapping: 'single',
};
const agoda = { ...booking, code: 'Agoda', title: 'Agoda', actions: [] };
const airbnb = { ...booking, code: 'AirBNB', title: 'Airbnb', kind: 'ota' };
const conn = (
  id: string,
  channel: string,
  extra: Partial<channex.ChannexChannelAttributes> = {},
) => ({
  type: 'channel',
  id,
  attributes: {
    id,
    title: `${channel} Luxx`,
    channel,
    currency: 'KZT',
    is_active: true,
    settings: { hotel_id: `${id}-hotel` },
    rate_plans: [],
    properties: ['p-1'],
    actions: [],
    expected_removal_date: null,
    inserted_at: '2026-09-01T00:00:00',
    updated_at: '2026-09-01T00:00:00',
    ...extra,
  },
});

function context(opts: { key?: boolean; mapped?: boolean; activity?: ChannelActivity } = {}) {
  const repo = {
    mappings: vi
      .fn()
      .mockResolvedValue(opts.mapped === false ? [] : [{ providerPropertyId: 'p-1' }]),
    channelActivity: vi.fn().mockResolvedValue(
      opts.activity ?? {
        reservations: [
          { source: 'OTA', channel: 'Booking.com', at: day(2) },
          { source: 'OTA', channel: 'BookingCom', at: day(5) },
          { source: 'OTA', channel: 'OneTwoTrip', at: day(3) },
          { source: 'WEBSITE', channel: null, at: day(1) },
          { source: 'DESK', channel: null, at: day(1) },
        ],
        events: [
          { uniqueId: 'BDC-1', otaName: 'Booking.com', status: 'PROCESSED', receivedAt: day(2) },
          { uniqueId: 'AGO-1', otaName: 'Agoda', status: 'FAILED', receivedAt: day(1) },
        ],
      },
    ),
  };
  const reader = {
    listChannelAdapters: vi.fn().mockResolvedValue([booking, agoda, airbnb]),
    listChannels: vi
      .fn()
      .mockResolvedValue([
        conn('c-bdc', 'BookingCom'),
        conn('c-ago', 'Agoda'),
        conn('c-abb', 'AirBNB', { is_active: false, expected_removal_date: '2026-10-20' }),
      ]),
    createOneTimeToken: vi.fn().mockResolvedValue('ott-1'),
  };
  const service = new ChannelCatalogService(
    repo as never,
    opts.key === false ? null : reader,
    () => NOW,
  );
  return { service, repo, reader };
}

describe('Каналы: подключённые и все доступные (Channel API Channex)', () => {
  it('статусы честные: «Работает» — включён, событие канала за 30 дней и нет ошибок входящих за 7 дней', () => {
    const base = { active: true, removalDate: null, lastEventAt: day(3), failedEvents7d: 0 };
    expect(channelStatus(base, NOW)).toBe('WORKING');
    expect(channelStatus({ ...base, failedEvents7d: 1 }, NOW)).toBe('ERRORS');
    expect(channelStatus({ ...base, lastEventAt: day(31) }, NOW)).toBe('ENABLED');
    expect(channelStatus({ ...base, lastEventAt: null }, NOW)).toBe('ENABLED');
    expect(channelStatus({ ...base, active: false }, NOW)).toBe('OFF');
    expect(channelStatus({ ...base, active: false, removalDate: '2026-10-20' }, NOW)).toBe(
      'REMOVING',
    );
  });

  it('список: подключения Channex, брони за 30 дней по ключу канала (оба написания Booking — один канал)', async () => {
    const c = context();
    const r = await c.service.list();
    expect(c.reader.listChannels).toHaveBeenCalledWith('p-1');
    expect(c.repo.channelActivity).toHaveBeenCalledWith('channex', new Date(day(30)));
    expect(r.state).toBe('READY');
    expect(
      r.connections.map((x) => [x.channelTitle, x.channelPropertyId, x.bookings30, x.status]),
    ).toEqual([
      ['Booking.com', 'c-bdc-hotel', 2, 'WORKING'],
      ['Agoda', 'c-ago-hotel', 0, 'ERRORS'],
      ['Airbnb', 'c-abb-hotel', 0, 'REMOVING'],
    ]);
    expect(r.connections[0]!.lastBookingAt).toBe(day(2));
  });

  it('брони мимо подключений — «Источники вне Channex»: канал без подключения и прямые источники', async () => {
    const r = await context().service.list();
    expect(r.outside).toEqual([
      {
        key: 'OTA:onetwotrip',
        source: 'OTA',
        label: 'OneTwoTrip',
        bookings30: 1,
        lastBookingAt: day(3),
      },
      { key: 'DESK', source: 'DESK', label: null, bookings30: 1, lastBookingAt: day(1) },
      { key: 'WEBSITE', source: 'WEBSITE', label: null, bookings30: 1, lastBookingAt: day(1) },
    ]);
  });

  it('все доступные: каталог Channex с отметкой «подключён», подключённые выше, дальше по алфавиту', async () => {
    const r = await context().service.list();
    expect(r.adapters?.map((a) => [a.title, a.connected])).toEqual([
      ['Agoda', true],
      ['Airbnb', true],
      ['Booking.com', true],
    ]);
  });

  it('без ключа и без сопоставленного объекта Channex не вызывается, причина словами', async () => {
    const noKey = context({ key: false });
    expect((await noKey.service.list()).state).toBe('NO_KEY');
    const noMap = context({ mapped: false });
    const r = await noMap.service.list();
    expect(r.state).toBe('NO_MAPPING');
    expect(noMap.reader.listChannels).not.toHaveBeenCalled();
    expect(r.outside.length).toBeGreaterThan(0);
  });

  it('Channex не ответил — экран живёт: брони вне Channex видны, состояние и причина', async () => {
    const c = context();
    c.reader.listChannels.mockRejectedValue(new channex.ChannexApiError('x', 401, '/channels'));
    const r = await c.service.list();
    expect(r.state).toBe('DENIED');
    expect(r.connections).toEqual([]);
    expect(r.outside.find((o) => o.label === 'Booking.com')?.bookings30).toBe(2);
  });

  it('каталог кэшируется: второй список не просит /channels/list заново', async () => {
    const c = context();
    await c.service.list();
    await c.service.list();
    expect(c.reader.listChannelAdapters).toHaveBeenCalledTimes(1);
    expect(c.reader.listChannels).toHaveBeenCalledTimes(2);
  });

  it('окно подключения: токен на объект, адрес Channex с кодом канала; без объекта — отказ', async () => {
    vi.stubEnv('CHANNEX_API_BASE_URL', '');
    const c = context();
    const s = await c.service.connectSession({ username: 'Анна Тестова', channel: 'BDC' });
    expect(c.reader.createOneTimeToken).toHaveBeenCalledWith({
      propertyId: 'p-1',
      username: 'Анна Тестова',
    });
    expect(s.url).toContain('https://staging.channex.io/auth/exchange?oauth_session_key=ott-1');
    expect(s.url).toContain('channels=BDC');
    await expect(
      context().service.connectSession({ username: 'x', channel: 'bad code!' }),
    ).rejects.toThrow(/код канала/i);
    await expect(
      context({ mapped: false }).service.connectSession({ username: 'x' }),
    ).rejects.toThrow(/объект/i);
  });
});
