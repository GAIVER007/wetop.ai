import { describe, expect, it, vi } from 'vitest';
import { ExelyUniversalClient } from './universal';

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
const make = (f: ReturnType<typeof fakeFetch>) =>
  new ExelyUniversalClient({
    apiKey: 'k',
    fetch: f.fetchFn as unknown as typeof fetch,
    sleep: async () => {},
  });

describe('ExelyUniversalClient (X-API-KEY)', () => {
  it('sends the key in X-API-KEY and lists rooms', async () => {
    const f = fakeFetch([
      { status: 200, body: [{ id: 'r1', name: '9001', roomTypeId: '900001' }] },
    ]);
    const rooms = await make(f).rooms();
    expect(rooms).toEqual([{ id: 'r1', name: '9001', roomTypeId: '900001' }]);
    expect(f.calls[0]!.url).toBe('https://connect.hopenapi.com/api/exelypms/v1/rooms');
    expect((f.calls[0]!.init.headers as Record<string, string>)['X-API-KEY']).toBe('k');
  });
  it('searchBookings builds the affects-period query and returns numbers', async () => {
    const f = fakeFetch([{ status: 200, body: { bookingNumbers: ['A', 'B'] } }]);
    const n = await make(f).searchBookings({
      state: 'Active',
      affectsPeriodFrom: '2026-09-08T00:00',
      affectsPeriodTo: '2027-09-07T00:00',
    });
    expect(n).toEqual(['A', 'B']);
    expect(f.calls[0]!.url).toContain('state=Active');
    expect(f.calls[0]!.url).toContain('affectsPeriodFrom=2026-09-08T00%3A00');
  });
  it('analyticsServices requires ≤31 days and yyyyMMdd; splits longer ranges into windows', async () => {
    const f = fakeFetch([
      {
        status: 200,
        body: {
          data: {
            services: [{ id: 's1' }],
            customers: [],
            agents: [],
            reservations: [{ id: 1 }],
            roomTypes: [],
          },
        },
      },
      {
        status: 200,
        body: {
          data: {
            services: [{ id: 's2' }],
            customers: [],
            agents: [],
            reservations: [{ id: 2 }],
            roomTypes: [],
          },
        },
      },
    ]);
    const r = await make(f).analyticsServices({
      startDate: '2026-08-01',
      endDate: '2026-09-05',
      dateKind: 1,
    });
    expect(r.services.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(r.reservations).toHaveLength(2);
    expect(f.calls[0]!.url).toContain('startDate=20260801&endDate=20260831&dateKind=1');
    expect(f.calls[1]!.url).toContain('startDate=20260901&endDate=20260905&dateKind=1');
  });
  it('analyticsPayments asks for payments made outside Exely only when told to', async () => {
    const f = fakeFetch([
      { status: 200, body: { data: { payments: [] } } },
      { status: 200, body: { data: { payments: [] } } },
    ]);
    const c = make(f);
    await c.analyticsPayments({ startDateTime: '202609010000', endDateTime: '202609131200' });
    await c.analyticsPayments({
      startDateTime: '202609010000',
      endDateTime: '202609131200',
      includeExternalPayments: true,
    });
    expect(f.calls[0]!.url).toBe(
      'https://connect.hopenapi.com/api/exelypms/v1/analytics/payments?startDateTime=202609010000&endDateTime=202609131200',
    );
    expect(f.calls[1]!.url).toContain('includeExternalPayments=true');
  });
  it('retries on 429 honouring retry-after and fails clearly on 401', async () => {
    const f = fakeFetch([
      { status: 429, body: {}, headers: { 'retry-after': '1' } },
      { status: 200, body: [] },
    ]);
    await expect(make(f).rooms()).resolves.toEqual([]);
    const g = fakeFetch([{ status: 401, body: { message: 'bad key' } }]);
    await expect(make(g).rooms()).rejects.toThrow(/401/);
  });
});
