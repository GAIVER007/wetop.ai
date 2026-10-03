import { describe, expect, it } from 'vitest';
import { ChannexClient } from './client';
import {
  channelIframeUrl,
  connectionChannelPropertyId,
  toAdapterView,
  toConnectionView,
  type ChannexChannelAdapter,
} from './channel-connections';

/** Формы ответов — из docs/channex/site/api-v.1-documentation/channel-api.md и channel-api-examples/*.md */
const booking: ChannexChannelAdapter = {
  code: 'BookingCom',
  title: 'Booking.com',
  kind: 'meta',
  actions: ['load_future_reservations'],
  mapping_mode: 'room_rate_multioccupancy',
  message_support: true,
  property_mapping: 'single',
  params: {
    hotel_id: { position: 0, type: 'string', title: 'Hotel ID' },
    machine_account: { position: 1, type: 'hidden', title: 'Machine Account ID' },
    send_email_notifications: { position: 2, type: 'boolean', default: false },
    email: { position: 3, type: 'string', title: 'Property Email' },
  },
  rate_params: null,
};
const custom: ChannexChannelAdapter = {
  ...booking,
  code: 'Szallas',
  title: 'Szallas',
  kind: 'ota',
  actions: [],
  params: {
    secret: { position: 0, type: 'password' },
    property_code: { position: 1, type: 'string' },
  },
};

function fakeFetch(body: (url: string, init: RequestInit) => unknown) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init: init ?? {} });
    return new Response(JSON.stringify(body(String(input), init ?? {})), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fn, calls };
}

describe('Channel API: каталог и подключения (только чтение)', () => {
  it('ID в канале — hotel_id, иначе первое видимое поле формы адаптера; пароль и скрытое не показываются', () => {
    expect(
      connectionChannelPropertyId({ hotel_id: '14087887', machine_account: 'x' }, booking),
    ).toBe('14087887');
    expect(connectionChannelPropertyId({ secret: 's3cr3t', property_code: 'P-9' }, custom)).toBe(
      'P-9',
    );
    expect(connectionChannelPropertyId({ secret: 's3cr3t' }, custom)).toBeNull();
    expect(connectionChannelPropertyId({ hotel_id: 42 }, undefined)).toBe('42');
  });

  it('подключение: ключ канала из кода адаптера, имя из каталога, состояние Channex как есть', () => {
    const v = toConnectionView(
      {
        type: 'channel',
        id: 'c-1',
        attributes: {
          id: 'c-1',
          title: 'Luxx at Booking',
          channel: 'BookingCom',
          currency: 'KZT',
          is_active: true,
          settings: { hotel_id: '14087887' },
          rate_plans: [{ id: 'm1', rate_plan_id: 'r1', settings: {} }],
          properties: ['p-1'],
          actions: ['load_future_reservations'],
          expected_removal_date: null,
          inserted_at: '2026-09-01T10:00:00',
          updated_at: '2026-09-01T10:00:00',
        },
      },
      new Map([['BookingCom', booking]]),
    );
    expect(v).toEqual({
      id: 'c-1',
      adapterCode: 'BookingCom',
      channelKey: 'bookingcom',
      channelTitle: 'Booking.com',
      connectionTitle: 'Luxx at Booking',
      channelPropertyId: '14087887',
      active: true,
      removalDate: null,
      mappedRatePlans: 1,
      actions: ['load_future_reservations'],
    });
  });

  it('канал объекта называется так же, как у броней: Emerging Travel Group → Ostrovok.ru', () => {
    const ostrovok = { ...custom, code: 'Ostrovok', title: 'Emerging Travel Group' };
    expect(toAdapterView(ostrovok).title).toBe('Ostrovok.ru');
    expect(toAdapterView({ ...custom, title: 'Klook' }).title).toBe('Klook');
  });

  it('адаптер каталога наружу без полей формы', () => {
    expect(toAdapterView(booking)).toEqual({
      code: 'BookingCom',
      channelKey: 'bookingcom',
      title: 'Booking.com',
      kind: 'meta',
      canLoadFutureReservations: true,
    });
  });

  it('клиент: GET /channels/list (массив без пагинации), GET /channels?filter[property_id] постранично', async () => {
    const f = fakeFetch((url) =>
      url.includes('/channels/list')
        ? { data: [booking] }
        : url.includes('/channels/codes')
          ? { data: [{ code: 'BDC', name: 'Booking.com' }] }
          : { data: [], meta: { total: 0 } },
    );
    const client = new ChannexClient({ apiKey: 'k', fetch: f.fn });
    expect(await client.listChannelAdapters()).toEqual([booking]);
    await client.listChannelCodes();
    await client.listChannels('p-1');
    expect(f.calls[0]!.url).toBe('https://staging.channex.io/api/v1/channels/list');
    expect(f.calls[1]!.url).toBe('https://staging.channex.io/api/v1/channels/codes');
    const u = new URL(f.calls[2]!.url);
    expect(u.pathname).toBe('/api/v1/channels');
    expect(u.searchParams.get('filter[property_id]')).toBe('p-1');
    expect(u.searchParams.get('pagination[limit]')).toBe('100');
  });

  it('одноразовый токен окна Channex: POST /auth/one_time_token, тело обёрнуто, наружу только токен', async () => {
    const f = fakeFetch(() => ({ data: { token: 'ott-1' }, meta: { message: 'ok' } }));
    const client = new ChannexClient({ apiKey: 'k', fetch: f.fn });
    expect(await client.createOneTimeToken({ propertyId: 'p-1', username: 'Владелец' })).toBe(
      'ott-1',
    );
    expect(f.calls[0]!.url).toBe('https://staging.channex.io/api/v1/auth/one_time_token');
    expect(JSON.parse(String(f.calls[0]!.init.body))).toEqual({
      one_time_token: { property_id: 'p-1', username: 'Владелец' },
    });
  });

  it('действие подключения: POST /channels/{id}/execute/{action} (channel-api-examples/booking.com.md, Actions)', async () => {
    const f = fakeFetch(() => ({ meta: { message: 'Success' } }));
    const client = new ChannexClient({ apiKey: 'k', fetch: f.fn });
    await client.executeChannelAction('c-1', 'load_future_reservations');
    expect(f.calls[0]!.url).toBe(
      'https://staging.channex.io/api/v1/channels/c-1/execute/load_future_reservations',
    );
    expect(f.calls[0]!.init.method).toBe('POST');
  });

  it('адрес окна: сервер без /api/v1, headless, русский, объект и канал', () => {
    const url = new URL(
      channelIframeUrl('https://staging.channex.io/api/v1', {
        token: 'ott-1',
        propertyId: 'p-1',
        channelCode: 'BDC',
      }),
    );
    expect(url.origin + url.pathname).toBe('https://staging.channex.io/auth/exchange');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      oauth_session_key: 'ott-1',
      app_mode: 'headless',
      redirect_to: '/channels',
      property_id: 'p-1',
      lng: 'ru',
      channels: 'BDC',
    });
    expect(
      new URL(
        channelIframeUrl('https://app.channex.io/api/v1/', { token: 't', propertyId: 'p' }),
      ).searchParams.has('channels'),
    ).toBe(false);
  });
});
