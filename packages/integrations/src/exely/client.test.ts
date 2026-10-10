import { describe, expect, it, vi } from 'vitest';
import { ExelyConnectClient, chunkDateRange } from './client';

/** Фальшивый fetch: очередь ответов + журнал запросов. Данные вымышленные (docs/exely, примеры). */
function fakeFetch(
  responses: Array<{ status: number; body: unknown; headers?: Record<string, string> }>,
) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchFn = vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error(`unexpected request: ${url}`);
    return new Response(JSON.stringify(next.body), {
      status: next.status,
      headers: { 'content-type': 'application/json', ...(next.headers ?? {}) },
    });
  });
  return { fetchFn, calls };
}
const token = (exp = 900) => ({
  status: 200,
  body: {
    access_token: 'tok-' + Math.random().toString(36).slice(2),
    expires_in: exp,
    token_type: 'Bearer',
  },
});
const make = (
  f: ReturnType<typeof fakeFetch>,
  extra: Partial<ConstructorParameters<typeof ExelyConnectClient>[0]> = {},
) =>
  new ExelyConnectClient({
    clientId: 'id',
    clientSecret: 'secret',
    propertyId: '999999',
    fetch: f.fetchFn as unknown as typeof fetch,
    sleep: async () => {},
    ...extra,
  });

describe('ExelyConnectClient', () => {
  it('requests a token once and reuses it for subsequent calls (Bearer header)', async () => {
    const f = fakeFetch([
      token(),
      { status: 200, body: { rooms: [], hasNextPage: false } },
      { status: 200, body: { rooms: [], hasNextPage: false } },
    ]);
    const c = make(f);
    await c.listRooms();
    await c.listRooms();
    expect(f.calls).toHaveLength(3);
    expect(f.calls[0]!.url).toBe('https://connect.hopenapi.com/auth/token');
    expect(String(f.calls[0]!.init.body)).toContain('grant_type=client_credentials');
    expect((f.calls[1]!.init.headers as Record<string, string>).Authorization).toMatch(
      /^Bearer tok-/,
    );
    expect(f.calls[1]!.url).toBe(
      'https://connect.hopenapi.com/api/pms/v2/properties/999999/rooms?maxPageSize=100',
    );
  });

  it('refreshes the token and retries once on 401', async () => {
    const f = fakeFetch([
      token(),
      { status: 401, body: { message: 'Unauthorized' } },
      token(),
      { status: 200, body: { rooms: [{ id: '1' }], hasNextPage: false } },
    ]);
    const rooms = await make(f).listRooms();
    expect(rooms).toHaveLength(1);
    expect(f.calls.map((x) => x.url.endsWith('/auth/token'))).toEqual([true, false, true, false]);
  });

  it('gives up after a second 401: gateway has not provisioned the client (ExelyAuthError)', async () => {
    const f = fakeFetch([
      token(),
      { status: 401, body: { message: 'Unauthorized' } },
      token(),
      { status: 401, body: { message: 'Unauthorized' } },
    ]);
    await expect(make(f).listRooms()).rejects.toThrow(/401/);
  });

  it('honours 429 retry-after and retries', async () => {
    const f = fakeFetch([
      token(),
      { status: 429, body: { message: 'Too Many' }, headers: { 'retry-after': '2' } },
      { status: 200, body: { rooms: [], hasNextPage: false } },
    ]);
    const sleep = vi.fn(async () => {});
    await make(f, { sleep }).listRooms();
    expect(sleep).toHaveBeenCalledWith(2000);
    expect(f.calls).toHaveLength(3);
  });

  it('walks reservation pages via nextPageToken until hasNextPage=false', async () => {
    const f = fakeFetch([
      token(),
      {
        status: 200,
        body: {
          reservations: [{ number: 'A' }, { number: 'B' }],
          hasNextPage: true,
          nextPageToken: 'T2',
        },
      },
      { status: 200, body: { reservations: [{ number: 'C' }], hasNextPage: false } },
    ]);
    const out: string[] = [];
    for await (const r of make(f).searchReservations({
      state: 'Active',
      startAffectPeriod: '2026-08-01T00:00',
      endAffectPeriod: '2026-09-01T00:00',
    }))
      out.push(r.number);
    expect(out).toEqual(['A', 'B', 'C']);
    expect(f.calls[1]!.url).toContain('state=Active');
    expect(f.calls[1]!.url).toContain('startAffectPeriodDateTime=2026-08-01T00%3A00');
    expect(f.calls[2]!.url).toContain('pageToken=T2');
    // с pageToken другие параметры игнорируются шлюзом — мы их и не шлём
    expect(f.calls[2]!.url).not.toContain('state=');
  });

  it('fetches daily occupancy in ≤31-day windows and concatenates days', async () => {
    const f = fakeFetch([
      token(),
      {
        status: 200,
        body: {
          currencyCode: 'KZT',
          propertyRoomCount: 88,
          dailyOccupancies: [{ date: '2026-08-01', occupancyRate: 0.5 }],
        },
      },
      {
        status: 200,
        body: {
          currencyCode: 'KZT',
          propertyRoomCount: 88,
          dailyOccupancies: [{ date: '2026-09-01', occupancyRate: 0.6 }],
        },
      },
    ]);
    const r = await make(f).dailyOccupancy('2026-08-01', '2026-09-05');
    expect(r.propertyRoomCount).toBe(88);
    expect(r.dailyOccupancies.map((d) => d.date)).toEqual(['2026-08-01', '2026-09-01']);
    expect(f.calls[1]!.url).toContain('startStayDate=2026-08-01&endStayDate=2026-08-31');
    expect(f.calls[2]!.url).toContain('startStayDate=2026-09-01&endStayDate=2026-09-05');
  });
});

describe('chunkDateRange', () => {
  it('splits an inclusive range into windows of at most N days', () => {
    expect(chunkDateRange('2026-08-01', '2026-08-31', 31)).toEqual([['2026-08-01', '2026-08-31']]);
    expect(chunkDateRange('2026-08-01', '2026-09-05', 31)).toEqual([
      ['2026-08-01', '2026-08-31'],
      ['2026-09-01', '2026-09-05'],
    ]);
    expect(() => chunkDateRange('2026-09-05', '2026-08-01', 31)).toThrow();
  });
});
