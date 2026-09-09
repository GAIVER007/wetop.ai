import { describe, expect, it } from 'vitest';
import { ChannexApiError, ChannexClient } from './client';

/** Ответы — из docs/channex/site/api-v.1-documentation (примеры документации, не живой sandbox). */
type Call = { url: string; init: RequestInit };
function fakeFetch(
  handler: (
    call: Call,
    n: number,
  ) => { status: number; body?: unknown; headers?: Record<string, string> },
) {
  const calls: Call[] = [];
  const fn: typeof fetch = async (input, init) => {
    const call = { url: String(input), init: init ?? {} };
    calls.push(call);
    const r = handler(call, calls.length);
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), {
      status: r.status,
      headers: { 'content-type': 'application/json', ...(r.headers ?? {}) },
    });
  };
  return { fn, calls };
}
const noSleep = { waits: [] as number[], sleep: async (ms: number) => void noSleep.waits.push(ms) };

describe('ChannexClient', () => {
  it('signs every request with user-api-key and wraps POST bodies by entity type (api-reference.md)', async () => {
    const f = fakeFetch(() => ({
      status: 201,
      body: {
        data: {
          type: 'room_type',
          id: '994d1375-dbbd-4072-8724-b2ab32ce781b',
          attributes: {
            id: '994d1375-dbbd-4072-8724-b2ab32ce781b',
            title: 'Standard Room',
            occ_adults: 3,
          },
        },
      },
    }));
    const c = new ChannexClient({ apiKey: 'test-key', fetch: f.fn, sleep: noSleep.sleep });
    const rt = await c.createRoomType({
      property_id: '716305c4-561a-4561-a187-7f5b8aeb5920',
      title: 'Standard Room',
      count_of_rooms: 20,
      occ_adults: 3,
      occ_children: 0,
      occ_infants: 0,
      default_occupancy: 2,
      room_kind: 'room',
    });
    expect(rt.id).toBe('994d1375-dbbd-4072-8724-b2ab32ce781b');
    expect(f.calls[0]!.url).toBe('https://staging.channex.io/api/v1/room_types');
    const headers = f.calls[0]!.init.headers as Record<string, string>;
    expect(headers['user-api-key']).toBe('test-key');
    expect(JSON.parse(f.calls[0]!.init.body as string)).toMatchObject({
      room_type: { title: 'Standard Room', count_of_rooms: 20 },
    });
  });

  it('traverses pagination with pagination[page]/[limit]=100 until meta.total is reached', async () => {
    const f = fakeFetch((call) => {
      const page = Number(new URL(call.url).searchParams.get('pagination[page]'));
      const data = Array.from({ length: page === 1 ? 100 : 5 }, (_, i) => ({
        type: 'property',
        id: `p${(page - 1) * 100 + i}`,
        attributes: { title: `H${i}` },
      }));
      return { status: 200, body: { data, meta: { limit: 100, page, total: 105 } } };
    });
    const c = new ChannexClient({ apiKey: 'k', fetch: f.fn, sleep: noSleep.sleep });
    const all = await c.listProperties();
    expect(all).toHaveLength(105);
    expect(f.calls).toHaveLength(2);
    expect(new URL(f.calls[0]!.url).searchParams.get('pagination[limit]')).toBe('100');
  });

  it('turns a 422 validation error into ChannexApiError with code and details, no retry', async () => {
    const f = fakeFetch(() => ({
      status: 422,
      body: {
        errors: {
          code: 'validation_error',
          title: 'Validation Error',
          details: { title: ["can't be blank"] },
        },
      },
    }));
    const c = new ChannexClient({ apiKey: 'SECRET-KEY-42', fetch: f.fn, sleep: noSleep.sleep });
    const err = await c.createProperty({ title: '', currency: 'KZT' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ChannexApiError);
    expect(err as ChannexApiError).toMatchObject({
      status: 422,
      code: 'validation_error',
      details: { title: ["can't be blank"] },
    });
    expect((err as Error).message).not.toContain('SECRET-KEY-42');
    expect(f.calls).toHaveLength(1);
  });

  it('pauses one minute on 429 (rate-limits.md) and retries; gives up after maxRetries', async () => {
    noSleep.waits.length = 0;
    let n = 0;
    const f = fakeFetch(() => {
      n += 1;
      return n < 3
        ? {
            status: 429,
            body: { errors: { code: 'http_too_many_requests', title: 'Too Many Requests' } },
          }
        : {
            status: 200,
            body: {
              data: [{ id: 't1', type: 'task' }],
              meta: { message: 'Success', warnings: [] },
            },
          };
    });
    const c = new ChannexClient({ apiKey: 'k', fetch: f.fn, sleep: noSleep.sleep });
    const res = await c.updateAvailability([
      { property_id: 'p', room_type_id: 'r', date: '2026-10-01', availability: 2 },
    ]);
    expect(res.data[0]).toEqual({ id: 't1', type: 'task' });
    expect(noSleep.waits).toEqual([60_000, 60_000]);

    const always = fakeFetch(() => ({
      status: 503,
      body: { errors: { code: 'service_unavailable', title: 'x' } },
    }));
    const c2 = new ChannexClient({
      apiKey: 'k',
      fetch: always.fn,
      sleep: noSleep.sleep,
      maxRetries: 2,
    });
    await expect(
      c2.updateRestrictions([
        { property_id: 'p', rate_plan_id: 'r', date: '2026-10-01', rate: 1500000 },
      ]),
    ).rejects.toMatchObject({ status: 503 });
    expect(always.calls).toHaveLength(3);
  });

  it('ARI: availability and restrictions go to separate endpoints with a values list (ari.md)', async () => {
    const f = fakeFetch(() => ({
      status: 200,
      body: { data: [{ id: 'task', type: 'task' }], meta: { message: 'Success', warnings: [] } },
    }));
    const c = new ChannexClient({ apiKey: 'k', fetch: f.fn, sleep: noSleep.sleep });
    await c.updateAvailability([
      {
        property_id: 'p',
        room_type_id: 'r',
        date_from: '2026-10-01',
        date_to: '2026-10-10',
        availability: 36,
      },
    ]);
    await c.updateRestrictions([
      {
        property_id: 'p',
        rate_plan_id: 'rp',
        date_from: '2026-10-01',
        date_to: '2026-10-10',
        rate: 1540000,
        stop_sell: false,
      },
    ]);
    expect(f.calls.map((x) => x.url.split('/v1')[1])).toEqual(['/availability', '/restrictions']);
    expect(JSON.parse(f.calls[1]!.init.body as string)).toEqual({
      values: [
        {
          property_id: 'p',
          rate_plan_id: 'rp',
          date_from: '2026-10-01',
          date_to: '2026-10-10',
          rate: 1540000,
          stop_sell: false,
        },
      ],
    });
  });

  it('booking revisions: feed ordered oldest first, get by id, ack by POST (bookings-collection.md)', async () => {
    const rev = {
      type: 'booking_revision',
      id: '03dd7198-c5b7-493c-a889-74d0c2211de7',
      attributes: {
        id: '03dd7198-c5b7-493c-a889-74d0c2211de7',
        unique_id: 'BDC-9996013801',
        status: 'new',
        rooms: [],
      },
    };
    const f = fakeFetch((call) =>
      call.url.includes('/ack')
        ? { status: 200, body: { meta: { message: 'Success' } } }
        : call.url.includes('/feed')
          ? { status: 200, body: { data: [rev], meta: { total: 1, page: 1, limit: 100 } } }
          : { status: 200, body: { data: rev } },
    );
    const c = new ChannexClient({ apiKey: 'k', fetch: f.fn, sleep: noSleep.sleep });
    const feed = await c.bookingRevisionsFeed('716305c4-561a-4561-a187-7f5b8aeb5920');
    expect(feed.map((r) => r.attributes.unique_id)).toEqual(['BDC-9996013801']);
    const u = new URL(f.calls[0]!.url);
    expect(u.pathname.endsWith('/booking_revisions/feed')).toBe(true);
    expect(u.searchParams.get('filter[property_id]')).toBe('716305c4-561a-4561-a187-7f5b8aeb5920');
    expect(u.searchParams.get('order[inserted_at]')).toBe('asc');
    expect((await c.getBookingRevision(rev.id)).id).toBe(rev.id);
    await c.ackBookingRevision(rev.id);
    expect(f.calls[2]!.init.method).toBe('POST');
    expect(f.calls[2]!.url.endsWith(`/booking_revisions/${rev.id}/ack`)).toBe(true);
  });
});

describe('ChannexClient webhooks (webhook-collection.md)', () => {
  const attrs = {
    callback_url: 'https://pms.example.kz/channels/channex/webhook',
    event_mask: 'booking',
    request_params: null,
    headers: { 'x-channex-webhook-secret': 'SECRET-KEY-42' },
    is_active: true,
    send_data: true,
    protected: false,
    is_global: false,
  };
  it('creates a property webhook wrapped in { webhook }, lists them with pagination, updates and tests', async () => {
    const f = fakeFetch((call) => {
      if (call.init.method === 'POST' && call.url.endsWith('/webhooks/test'))
        return { status: 200, body: { status_code: 200, body: '{"ok":true}' } };
      if (call.init.method === 'POST')
        return {
          status: 201,
          body: {
            data: {
              type: 'webhook',
              id: 'wh-1',
              attributes: attrs,
              relationships: { property: { data: { type: 'property', id: 'prop-1' } } },
            },
          },
        };
      if (call.init.method === 'PUT')
        return { status: 200, body: { data: { type: 'webhook', id: 'wh-1', attributes: attrs } } };
      return {
        status: 200,
        body: {
          data: [{ type: 'webhook', id: 'wh-1', attributes: attrs }],
          meta: { page: 1, limit: 100, total: 1 },
        },
      };
    });
    const c = new ChannexClient({ apiKey: 'k', fetch: f.fn, sleep: noSleep.sleep });
    const created = await c.createWebhook({
      callback_url: attrs.callback_url,
      event_mask: 'booking',
      property_id: 'prop-1',
      headers: attrs.headers,
      is_active: true,
      send_data: true,
    });
    expect(created.id).toBe('wh-1');
    expect(f.calls[0]!.url).toBe('https://staging.channex.io/api/v1/webhooks');
    expect(JSON.parse(f.calls[0]!.init.body as string)).toEqual({
      webhook: {
        callback_url: attrs.callback_url,
        event_mask: 'booking',
        property_id: 'prop-1',
        headers: { 'x-channex-webhook-secret': 'SECRET-KEY-42' },
        is_active: true,
        send_data: true,
      },
    });
    const list = await c.listWebhooks();
    expect(list.map((w) => w.id)).toEqual(['wh-1']);
    expect(f.calls[1]!.url).toContain('/webhooks?pagination%5Bpage%5D=1');
    await c.updateWebhook('wh-1', {
      callback_url: attrs.callback_url,
      event_mask: 'booking',
      property_id: 'prop-1',
    });
    expect(f.calls[2]!.init.method).toBe('PUT');
    expect(f.calls[2]!.url).toBe('https://staging.channex.io/api/v1/webhooks/wh-1');
    const t = await c.testWebhook({
      callback_url: attrs.callback_url,
      event_mask: 'booking',
      property_id: 'prop-1',
    });
    expect(t).toEqual({ status_code: 200, body: '{"ok":true}' });
    expect(f.calls[3]!.url).toBe('https://staging.channex.io/api/v1/webhooks/test');
  });
});
