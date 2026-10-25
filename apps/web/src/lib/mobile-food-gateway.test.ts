import { describe, expect, it, vi } from 'vitest';
import { handleMobileFoodGateway, type MobileFoodGatewayEnv } from './mobile-food-gateway';

const ENABLED: MobileFoodGatewayEnv = {
  MOBILE_GATEWAY_ENABLED: '1',
  APP_API_URL: 'http://127.0.0.1:3001',
};
const TOKEN = 'mobile-session-token';
const B = '11111111-1111-4111-8111-111111111111';
const L = '22222222-2222-4222-8222-222222222222';
const SCOPE = `business=${B};location=${L}`;

function request(action: string, init: RequestInit = {}): Request {
  return new Request(`https://app.wetop.ai/api/mobile/v1/food/${action}`, init);
}

function authorized(headers: HeadersInit = {}): HeadersInit {
  return { authorization: `Bearer ${TOKEN}`, 'x-wetop-scope': SCOPE, ...headers };
}

function upstream(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers });
}

describe('mobile food gateway boundary', () => {
  it('is disabled by default and allows only declared GET actions', async () => {
    const fetcher = vi.fn();
    expect((await handleMobileFoodGateway(request('tables'), 'tables', {}, fetcher)).status).toBe(
      404,
    );
    expect(
      (await handleMobileFoodGateway(request('payments'), 'payments', ENABLED, fetcher)).status,
    ).toBe(404);
    expect(
      (await handleMobileFoodGateway(request('toString'), 'toString', ENABLED, fetcher)).status,
    ).toBe(404);
    expect(
      (
        await handleMobileFoodGateway(
          request('orders', { method: 'POST' }),
          'orders',
          ENABLED,
          fetcher,
        )
      ).status,
    ).toBe(405);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('requires bearer auth and a location scope instead of cookies or business-only scope', async () => {
    const fetcher = vi.fn();
    const cookie = await handleMobileFoodGateway(
      request('tables', { headers: { cookie: 'wetop_session=secret', 'x-wetop-scope': SCOPE } }),
      'tables',
      ENABLED,
      fetcher,
    );
    const businessOnly = await handleMobileFoodGateway(
      request('tables', {
        headers: { authorization: `Bearer ${TOKEN}`, 'x-wetop-scope': `business=${B}` },
      }),
      'tables',
      ENABLED,
      fetcher,
    );
    const malformed = await handleMobileFoodGateway(
      request('tables', { headers: { authorization: `Bearer ${TOKEN}`, 'x-wetop-scope': 'bad' } }),
      'tables',
      ENABLED,
      fetcher,
    );
    expect([cookie.status, businessOnly.status, malformed.status]).toEqual([401, 400, 400]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects service credentials and unknown query fields before contacting the API', async () => {
    const fetcher = vi.fn();
    const serviceKey = await handleMobileFoodGateway(
      request('tables', { headers: authorized({ 'x-api-key': 'secret' }) }),
      'tables',
      ENABLED,
      fetcher,
    );
    const extra = await handleMobileFoodGateway(
      request('orders?open=0', { headers: authorized() }),
      'orders',
      ENABLED,
      fetcher,
    );
    expect([serviceKey.status, extra.status]).toEqual([403, 400]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('filters waiter tables and forwards only bearer, location scope and user agent', async () => {
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe('http://127.0.0.1:3001/food-service/waiter/tables');
      const headers = new Headers(init.headers);
      expect(headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
      expect(headers.get('x-wetop-scope')).toBe(SCOPE);
      expect(headers.get('user-agent')).toBe('WETOP Mobile Test');
      expect(headers.get('cookie')).toBeNull();
      expect(headers.get('x-api-key')).toBeNull();
      return upstream({
        me: { id: 'employee-1', name: 'Waiter', salary: 'drop' },
        tables: [
          {
            id: 'table-1',
            name: 'T1',
            capacity: 4,
            areaId: 'area-1',
            areaName: 'Hall',
            busy: true,
            mine: true,
            needsCleaning: false,
            internal: 'drop',
          },
        ],
        internal: 'drop',
      });
    });
    const response = await handleMobileFoodGateway(
      request('tables', {
        headers: authorized({ 'user-agent': 'WETOP Mobile Test', cookie: 'old=secret' }),
      }),
      'tables',
      ENABLED,
      fetcher,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      me: { id: 'employee-1', name: 'Waiter' },
      tables: [
        {
          id: 'table-1',
          name: 'T1',
          capacity: 4,
          areaName: 'Hall',
          busy: true,
          mine: true,
          needsCleaning: false,
        },
      ],
    });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('builds the fixed open-orders query with an optional validated cursor and filters the DTO', async () => {
    const fetcher = vi.fn(async (url: string) => {
      expect(url).toBe(`http://127.0.0.1:3001/food-service/orders?open=1&limit=100&cursor=${L}`);
      return upstream({
        items: [
          {
            id: 'order-1',
            number: 42,
            status: 'COOKING',
            table: { id: 'table-1', name: 'T1', areaName: 'drop' },
            waiter: { id: 'employee-1', name: 'Waiter', phone: 'drop' },
            guestCount: 3,
            totalMinor: '900719925474099300',
            paidMinor: '0',
            currency: 'KZT',
            updatedAt: '2026-10-24T10:00:00.000Z',
            delayed: false,
            items: [
              {
                id: 'item-1',
                name: 'Tea',
                qty: 2,
                status: 'NEW',
                station: 'BAR',
                priceMinor: '120000',
                menuItemId: 'menu-1',
                notes: 'drop',
                paid: false,
              },
            ],
            payments: [{ token: 'drop' }],
            notes: 'drop',
          },
        ],
        nextCursor: L,
        internal: 'drop',
      });
    });
    const response = await handleMobileFoodGateway(
      request(`orders?cursor=${L}`, { headers: authorized() }),
      'orders',
      ENABLED,
      fetcher,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [
        {
          id: 'order-1',
          number: 42,
          status: 'COOKING',
          table: { id: 'table-1', name: 'T1' },
          waiter: { id: 'employee-1', name: 'Waiter' },
          guestCount: 3,
          totalMinor: '900719925474099300',
          paidMinor: '0',
          currency: 'KZT',
          updatedAt: '2026-10-24T10:00:00.000Z',
          delayed: false,
          items: [
            {
              id: 'item-1',
              name: 'Tea',
              qty: 2,
              status: 'NEW',
              station: 'BAR',
              priceMinor: '120000',
            },
          ],
        },
      ],
      nextCursor: L,
    });
  });

  it('filters paged menu categories and keeps the verified station field', async () => {
    const fetcher = vi.fn(async (url: string) => {
      expect(url).toBe(`http://127.0.0.1:3001/food-service/menu/categories?limit=100&cursor=${L}`);
      return upstream({
        items: [
          {
            id: 'category-1',
            businessId: B,
            name: 'Drinks',
            sortOrder: 2,
            active: true,
            station: 'BAR',
            createdAt: 'drop',
            updatedAt: 'drop',
          },
        ],
        nextCursor: L,
        internal: 'drop',
      });
    });
    const response = await handleMobileFoodGateway(
      request(`categories?cursor=${L}`, { headers: authorized() }),
      'categories',
      ENABLED,
      fetcher,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [{ id: 'category-1', name: 'Drinks', sortOrder: 2, active: true, station: 'BAR' }],
      nextCursor: L,
    });
  });

  it('filters paged menu items, photos and active modifier choices without exposing tech cards', async () => {
    const fetcher = vi.fn(async (url: string) => {
      expect(url).toBe('http://127.0.0.1:3001/food-service/menu/items?limit=100');
      return upstream({
        items: [
          {
            id: 'menu-1',
            categoryId: 'category-1',
            name: 'Coffee',
            weightGrams: null,
            priceMinor: '900719925474099300',
            currency: 'KZT',
            active: true,
            techNotes: 'drop',
            sortOrder: 1,
            updatedAt: '2026-10-24T10:00:00.000Z',
            photoUrl: 'https://cdn.example.test/coffee.jpg?signature=temporary',
            modifierGroupIds: ['group-1'],
            ingredients: [{ secret: 'drop' }],
            totals: { costMinor: 'drop' },
            modifierGroups: [
              {
                id: 'group-1',
                name: 'Milk',
                minSelect: 0,
                maxSelect: 2,
                required: false,
                internal: 'drop',
                modifiers: [
                  {
                    id: 'modifier-1',
                    name: 'Oat',
                    priceDeltaMinor: '20000',
                    sortOrder: 0,
                    active: true,
                  },
                  {
                    id: 'modifier-2',
                    name: 'No milk',
                    priceDeltaMinor: '-10000',
                    sortOrder: 1,
                    active: true,
                  },
                ],
              },
            ],
          },
        ],
        nextCursor: null,
      });
    });
    const response = await handleMobileFoodGateway(
      request('items', { headers: authorized() }),
      'items',
      ENABLED,
      fetcher,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [
        {
          id: 'menu-1',
          categoryId: 'category-1',
          name: 'Coffee',
          weightGrams: null,
          priceMinor: '900719925474099300',
          currency: 'KZT',
          active: true,
          sortOrder: 1,
          updatedAt: '2026-10-24T10:00:00.000Z',
          photoUrl: 'https://cdn.example.test/coffee.jpg?signature=temporary',
          modifierGroups: [
            {
              id: 'group-1',
              name: 'Milk',
              minSelect: 0,
              maxSelect: 2,
              required: false,
              modifiers: [
                { id: 'modifier-1', name: 'Oat', priceDeltaMinor: '20000' },
                { id: 'modifier-2', name: 'No milk', priceDeltaMinor: '-10000' },
              ],
            },
          ],
        },
      ],
      nextCursor: null,
    });
  });

  it('rejects malformed menu money and modifier DTOs', async () => {
    const fetcher = vi.fn(async () =>
      upstream({
        items: [
          {
            id: 'menu-1',
            categoryId: 'category-1',
            name: 'Coffee',
            weightGrams: 200,
            priceMinor: '10000',
            currency: 'KZT',
            active: true,
            sortOrder: 1,
            updatedAt: '2026-10-24T10:00:00.000Z',
            photoUrl: null,
            modifierGroups: [
              {
                id: 'group-1',
                name: 'Milk',
                minSelect: 0,
                maxSelect: 1,
                required: false,
                modifiers: [{ id: 'modifier-1', name: 'Oat', priceDeltaMinor: 1.5 }],
              },
            ],
          },
        ],
        nextCursor: null,
      }),
    );
    const response = await handleMobileFoodGateway(
      request('items', { headers: authorized() }),
      'items',
      ENABLED,
      fetcher,
    );
    expect(response.status).toBe(502);
  });

  it('rejects malformed cursors without calling upstream', async () => {
    const fetcher = vi.fn();
    const response = await handleMobileFoodGateway(
      request('orders?cursor=not-a-uuid', { headers: authorized() }),
      'orders',
      ENABLED,
      fetcher,
    );
    expect(response.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects unsafe money and malformed upstream payloads', async () => {
    const fetcher = vi.fn(async () =>
      upstream({
        items: [
          {
            id: 'order-1',
            number: 1,
            status: 'NEW',
            table: null,
            waiter: null,
            guestCount: 1,
            totalMinor: 123.45,
            paidMinor: '0',
            currency: 'KZT',
            updatedAt: 'now',
            delayed: false,
            items: [],
          },
        ],
        nextCursor: null,
      }),
    );
    const response = await handleMobileFoodGateway(
      request('orders', { headers: authorized() }),
      'orders',
      ENABLED,
      fetcher,
    );
    expect(response.status).toBe(502);
  });

  it('sanitizes upstream errors and enforces the response size limit', async () => {
    const failed = vi.fn(async () => upstream({ message: `private ${TOKEN}` }, 500));
    const failure = await handleMobileFoodGateway(
      request('tables', { headers: authorized() }),
      'tables',
      ENABLED,
      failed,
    );
    expect(failure.status).toBe(503);
    expect(await failure.json()).toEqual({
      message: 'Сервис временно недоступен. Попробуйте ещё раз.',
    });

    const oversized = vi.fn(async () => upstream({}, 200, { 'content-length': '600000' }));
    const large = await handleMobileFoodGateway(
      request('tables', { headers: authorized() }),
      'tables',
      ENABLED,
      oversized,
    );
    expect(large.status).toBe(502);
  });
});

describe('mobile cash read boundary', () => {
  it('requires bearer and scope, then filters balances and recent payments', async () => {
    const fetcher = vi.fn(async (url: string) => {
      expect(url).toBe('http://127.0.0.1:3001/food-service/cash');
      return upstream({
        currency: 'KZT',
        balances: [{ method: 'CASH', balanceMinor: '900719925474099312', secret: 'drop' }],
        payments: [
          {
            id: 'p',
            orderNumber: 42,
            method: 'CARD_TERMINAL',
            amountMinor: '780000',
            status: 'COMPLETED',
            paidAt: '2026-10-24T12:00:00Z',
            secret: 'drop',
          },
        ],
        operations: [{ secret: 'drop' }],
      });
    });
    expect((await handleMobileFoodGateway(request('cash'), 'cash', ENABLED, fetcher)).status).toBe(
      401,
    );
    const response = await handleMobileFoodGateway(
      request('cash', { headers: authorized() }),
      'cash',
      ENABLED,
      fetcher,
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.balances[0].balanceMinor).toBe('900719925474099312');
    expect(body.payments[0].amountMinor).toBe('780000');
    expect(JSON.stringify(body)).not.toContain('secret');
  });
  it('rejects unsupported cash query', async () => {
    const fetcher = vi.fn();
    expect(
      (
        await handleMobileFoodGateway(
          request('cash?from=2026-10-24', { headers: authorized() }),
          'cash',
          ENABLED,
          fetcher,
        )
      ).status,
    ).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('mobile restaurant report boundary', () => {
  it('rejects absent or malformed reporting dates without upstream calls', async () => {
    const fetcher = vi.fn();
    for (const path of [
      'overview',
      'overview?date=2026-02-30',
      'analytics?from=2026-10-24',
      'analytics?from=2026-10-25&to=2026-10-24',
    ]) {
      const action = path.split('?')[0]!;
      expect(
        (
          await handleMobileFoodGateway(
            request(path, { headers: authorized() }),
            action,
            ENABLED,
            fetcher,
          )
        ).status,
      ).toBe(400);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('filters day report and period amounts without adding payment methods to revenue', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith('/food-service/report?date=2026-10-24'))
        return upstream({
          date: '2026-10-24',
          currency: 'KZT',
          tiles: {
            tablesOccupied: 3,
            tablesTotal: 8,
            ordersCount: 24,
            revenueMinor: '900719925474099312',
            kitchenQueue: 2,
            kitchenAvgWaitMinutes: 14,
            staffOnShift: 6,
            staffTotal: 9,
            internal: 'drop',
          },
          latestOrders: [{ guest: 'drop' }],
        });
      expect(url).toBe(
        'http://127.0.0.1:3001/food-service/period-report?from=2026-10-24&to=2026-10-24',
      );
      return upstream({
        from: '2026-10-24',
        to: '2026-10-24',
        currency: 'KZT',
        ordersCount: 20,
        revenueMinor: '1200000',
        averageCheckMinor: '60000',
        payments: [{ method: 'CASH', amountMinor: '500000', count: 5 }],
        topDishes: [{ name: 'Кофе', qty: 10, revenueMinor: '120000' }],
        topByStation: {
          KITCHEN: [{ name: 'Паста', qty: 6, revenueMinor: '300000' }],
          BAR: [{ name: 'Кофе', qty: 10, revenueMinor: '120000' }],
        },
        revenueByDay: [{ date: '2026-10-24', revenueMinor: '1200000', orders: 20 }],
        waiters: [
          { waiterId: 'employee-1', name: 'Тестовый сотрудник', orders: 5, revenueMinor: '400000' },
        ],
        internal: 'drop',
      });
    });
    const a = await handleMobileFoodGateway(
      request('overview?date=2026-10-24', { headers: authorized() }),
      'overview',
      ENABLED,
      fetcher,
    );
    const b = await handleMobileFoodGateway(
      request('analytics?from=2026-10-24&to=2026-10-24', { headers: authorized() }),
      'analytics',
      ENABLED,
      fetcher,
    );
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect((await a.json()).tiles.revenueMinor).toBe('900719925474099312');
    const period = await b.json();
    expect(period.revenueMinor).toBe('1200000');
    expect(period.payments[0].amountMinor).toBe('500000');
    expect(period.topByStation.BAR[0].name).toBe('Кофе');
    expect(period.waiters[0].waiterId).toBe('employee-1');
    expect(JSON.stringify(period)).not.toContain('drop');
  });
});

describe('mobile restaurant team boundary', () => {
  it('returns only branch shift names and intervals, dropping revision metadata', async () => {
    const fetcher = vi.fn(async (url: string) => {
      expect(url).toBe('http://127.0.0.1:3001/food-service/shifts');
      return upstream({
        employees: [
          {
            id: 'employee-1',
            name: 'Тестовый сотрудник',
            weekRevision: 'secret',
            week: [{ weekday: 1, intervals: [{ timeFrom: '09:00', timeTo: '18:00' }] }],
            phone: 'drop',
          },
        ],
      });
    });
    const response = await handleMobileFoodGateway(
      request('shifts', { headers: authorized() }),
      'shifts',
      ENABLED,
      fetcher,
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.employees[0]).toEqual({
      id: 'employee-1',
      name: 'Тестовый сотрудник',
      week: [{ weekday: 1, intervals: [{ timeFrom: '09:00', timeTo: '18:00' }] }],
    });
    expect(JSON.stringify(body)).not.toContain('secret');
  });
  it('keeps signed paid-minus-refunded staff contribution and unattributed money', async () => {
    const fetcher = vi.fn(async (url: string) => {
      expect(url).toBe('http://127.0.0.1:3001/food-service/staff-revenue?period=week');
      return upstream({
        period: 'week',
        fromDate: '2026-10-19',
        toDate: '2026-10-25',
        items: [
          {
            employeeId: 'employee-1',
            currency: 'KZT',
            paidMinor: '100',
            refundedMinor: '150',
            netMinor: '-50',
          },
          {
            employeeId: null,
            currency: 'KZT',
            paidMinor: '25',
            refundedMinor: '0',
            netMinor: '25',
          },
        ],
        private: 'drop',
      });
    });
    const response = await handleMobileFoodGateway(
      request('staff-revenue?period=week', { headers: authorized() }),
      'staff-revenue',
      ENABLED,
      fetcher,
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items.map((row: { netMinor: string }) => row.netMinor)).toEqual(['-50', '25']);
    expect(JSON.stringify(body)).not.toContain('drop');
  });
});

describe('mobile order creation', () => {
  const enabled = { ...ENABLED, MOBILE_ORDER_CREATE_ENABLED: '1' };
  const body = {
    creationRequestKey: 'attempt-001',
    guestCount: 1,
    items: [{ menuItemId: B, qty: 1 }],
  };
  const create = (value: unknown = body, headers: HeadersInit = authorized()) =>
    request('orders', {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify(value),
    });
  const order = {
    id: B,
    number: 1,
    status: 'NEW',
    table: null,
    waiter: null,
    guestCount: 1,
    totalMinor: '1000',
    paidMinor: '0',
    currency: 'KZT',
    updatedAt: '2026-10-25T00:00:00Z',
    delayed: false,
    items: [],
  };
  it('forwards one keyed request with only bearer and scope and returns a filtered order', async () => {
    const fetcher = vi.fn(async () =>
      upstream({ ...order, creationRequestHash: 'private', notes: 'private' }, 201),
    );
    const response = await handleMobileFoodGateway(
      create(body, authorized({ cookie: 'private', 'x-forwarded-for': '1.2.3.4' })),
      'orders',
      enabled,
      fetcher,
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(order);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:3001/food-service/orders');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toMatchObject(body);
    expect(new Headers(init.headers).get('cookie')).toBeNull();
    expect(new Headers(init.headers).get('x-forwarded-for')).toBeNull();
  });
  it('requires a key and rejects client prices before contacting the API', async () => {
    const fetcher = vi.fn();
    for (const value of [
      { guestCount: 1, items: body.items },
      { ...body, total: 1 },
      { ...body, creationRequestKey: '' },
    ])
      expect(
        (await handleMobileFoodGateway(create(value), 'orders', enabled, fetcher)).status,
      ).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('keeps creation disabled separately and rejects unauthenticated calls', async () => {
    const fetcher = vi.fn();
    expect((await handleMobileFoodGateway(create(), 'orders', ENABLED, fetcher)).status).toBe(405);
    expect(
      (await handleMobileFoodGateway(create(body, {}), 'orders', enabled, fetcher)).status,
    ).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('marks a lost or invalid response as unknown and never retries upstream', async () => {
    for (const fetcher of [
      vi.fn().mockRejectedValue(new Error('timeout')),
      vi.fn(async () => upstream({ invalid: true }, 201)),
      vi.fn(async () => upstream({ message: 'private' }, 500)),
    ]) {
      const response = await handleMobileFoodGateway(create(), 'orders', enabled, fetcher);
      expect([502, 503]).toContain(response.status);
      expect(await response.json()).toMatchObject({ outcome: 'unknown' });
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
  it('preserves conflict status without leaking upstream details', async () => {
    const response = await handleMobileFoodGateway(create(), 'orders', enabled, async () =>
      upstream({ message: 'private' }, 409),
    );
    expect(response.status).toBe(409);
    expect(JSON.stringify(await response.json())).not.toContain('private');
  });
  it('rejects query strings and oversized request bodies before upstream', async () => {
    const fetcher = vi.fn();
    const query = request('orders?cursor=' + L, {
      method: 'POST',
      headers: authorized(),
      body: JSON.stringify(body),
    });
    expect((await handleMobileFoodGateway(query, 'orders', enabled, fetcher)).status).toBe(400);
    expect(
      (
        await handleMobileFoodGateway(
          create({ ...body, notes: 'x'.repeat(600000) }),
          'orders',
          enabled,
          fetcher,
        )
      ).status,
    ).toBe(413);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

it('cancels a stalled create upload before contacting upstream', async () => {
  vi.useFakeTimers();
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({ cancel });
  const fetcher = vi.fn();
  const req = new Request('https://app.wetop.ai/api/mobile/v1/food/orders', {
    method: 'POST',
    headers: authorized({ 'content-type': 'application/json' }),
    body,
    duplex: 'half',
  } as RequestInit);
  try {
    const pending = handleMobileFoodGateway(
      req,
      'orders',
      { ...ENABLED, MOBILE_ORDER_CREATE_ENABLED: '1' },
      fetcher,
    );
    await vi.advanceTimersByTimeAsync(10001);
    expect((await pending).status).toBe(400);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(fetcher).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});

describe('mobile serve position', () => {
  const env = { ...ENABLED, MOBILE_ORDER_SERVE_ENABLED: '1' };
  const body = { orderId: B, itemId: L, expectedUpdatedAt: '2026-10-25T12:00:00.000Z' };
  const req = (value: unknown = body) =>
    request('serve', {
      method: 'POST',
      headers: authorized({ 'content-type': 'application/json' }),
      body: JSON.stringify(value),
    });
  it('forwards only SERVED with the original version and bearer scope', async () => {
    const fetcher = vi.fn(async () => upstream({ message: 'conflict' }, 409));
    const result = await handleMobileFoodGateway(req(), 'serve', env, fetcher);
    expect(result.status).toBe(409);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toBe(`http://127.0.0.1:3001/food-service/orders/${B}/items/${L}/status`);
    expect(JSON.parse(init.body as string)).toEqual({
      status: 'SERVED',
      expectedUpdatedAt: body.expectedUpdatedAt,
    });
    expect(new Headers(init.headers).get('x-wetop-scope')).toBe(SCOPE);
  });
  it('rejects arbitrary statuses, paths, fields and empty versions before upstream', async () => {
    const fetcher = vi.fn();
    for (const value of [
      { ...body, status: 'READY' },
      { ...body, itemId: '../payments' },
      { ...body, expectedUpdatedAt: '' },
    ])
      expect((await handleMobileFoodGateway(req(value), 'serve', env, fetcher)).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('stays disabled independently and never allows a GET mutation', async () => {
    const fetcher = vi.fn();
    expect((await handleMobileFoodGateway(req(), 'serve', ENABLED, fetcher)).status).toBe(405);
    expect(
      (
        await handleMobileFoodGateway(
          request('serve', { headers: authorized() }),
          'serve',
          env,
          fetcher,
        )
      ).status,
    ).toBe(405);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('lost response requires refresh instead of retry with a new version', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('lost'));
    const result = await handleMobileFoodGateway(req(), 'serve', env, fetcher);
    expect(result.status).toBe(503);
    expect(await result.json()).toMatchObject({ outcome: 'unknown' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

it('returns filtered serving confirmation and preserves server authorization denial', async () => {
  const env = { ...ENABLED, MOBILE_ORDER_SERVE_ENABLED: '1' };
  const req = () =>
    request('serve', {
      method: 'POST',
      headers: authorized({ 'content-type': 'application/json' }),
      body: JSON.stringify({
        orderId: B,
        itemId: L,
        expectedUpdatedAt: '2026-10-25T00:00:00.000Z',
      }),
    });
  const order = {
    id: B,
    number: 1,
    status: 'SERVED',
    table: null,
    waiter: null,
    guestCount: 1,
    totalMinor: '100',
    paidMinor: '0',
    currency: 'KZT',
    updatedAt: '2026-10-25T00:01:00.000Z',
    delayed: false,
    items: [
      {
        id: L,
        name: 'Кофе',
        qty: 1,
        priceMinor: '100',
        station: 'BAR',
        status: 'SERVED',
        private: 'hidden',
      },
    ],
    private: 'hidden',
  };
  const result = await handleMobileFoodGateway(req(), 'serve', env, async () => upstream(order));
  expect(result.status).toBe(200);
  expect(JSON.stringify(await result.json())).not.toContain('hidden');
  const denied = await handleMobileFoodGateway(req(), 'serve', env, async () =>
    upstream({ message: 'private' }, 403),
  );
  expect(denied.status).toBe(403);
  expect(JSON.stringify(await denied.json())).not.toContain('private');
});

describe('mobile payment preparation', () => {
  it('reads only actual branch methods without pagination or private metadata', async () => {
    const fetcher = vi.fn(async () =>
      upstream({
        methods: [
          { method: 'CASH', enabled: true, sortOrder: 1, private: 'hidden' },
          { method: 'KASPI', enabled: false, sortOrder: 0 },
        ],
      }),
    );
    const result = await handleMobileFoodGateway(
      request('payment-methods', { headers: authorized() }),
      'payment-methods',
      ENABLED,
      fetcher,
    );
    expect(result.status).toBe(200);
    expect((fetcher.mock.calls[0] as unknown as [string, RequestInit])[0]).toBe(
      'http://127.0.0.1:3001/food-service/payment-methods',
    );
    expect(await result.json()).toEqual({
      methods: [
        { method: 'CASH', enabled: true, sortOrder: 1 },
        { method: 'KASPI', enabled: false, sortOrder: 0 },
      ],
    });
  });
  it('does not invent methods from malformed or unsupported settings', async () => {
    for (const methods of [
      [{ method: 'AGGREGATOR', enabled: true, sortOrder: 0 }],
      [{ method: 'CASH', enabled: 'yes', sortOrder: 0 }],
      [
        { method: 'CASH', enabled: true, sortOrder: 0 },
        { method: 'CASH', enabled: false, sortOrder: 1 },
      ],
    ]) {
      const result = await handleMobileFoodGateway(
        request('payment-methods', { headers: authorized() }),
        'payment-methods',
        ENABLED,
        async () => upstream({ methods }),
      );
      expect(result.status).toBe(502);
    }
  });
});

describe('mobile payment submission', () => {
  const env = { ...ENABLED, MOBILE_ORDER_PAYMENT_ENABLED: '1' };
  const body = { orderId: B, method: 'CASH', amount: 1234, idempotencyKey: 'payment-one' };
  const req = (value: unknown = body) =>
    request('pay', {
      method: 'POST',
      headers: authorized({ 'content-type': 'application/json' }),
      body: JSON.stringify(value),
    });
  it('forwards exact integer amount and original key once to order payment endpoint', async () => {
    const fetcher = vi.fn(async () => upstream({ message: 'not allowed' }, 403));
    const result = await handleMobileFoodGateway(req(), 'pay', env, fetcher);
    expect(result.status).toBe(403);
    const [url, init] = fetcher.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toBe(`http://127.0.0.1:3001/food-service/orders/${B}/payments`);
    expect(JSON.parse(init.body as string)).toEqual({
      method: 'CASH',
      amount: 1234,
      idempotencyKey: 'payment-one',
      itemIds: null,
    });
    expect(new Headers(init.headers).get('authorization')).toBe(`Bearer ${TOKEN}`);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects malformed money, missing key, foreign path and extra fields without upstream', async () => {
    const fetcher = vi.fn();
    for (const value of [
      { ...body, amount: 1.1 },
      { ...body, amount: Number.MAX_SAFE_INTEGER + 1 },
      { ...body, idempotencyKey: '' },
      { ...body, orderId: '../other' },
      { ...body, total: 1 },
    ])
      expect((await handleMobileFoodGateway(req(value), 'pay', env, fetcher)).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('keeps payment disabled separately and rejects GET mutations', async () => {
    const fetcher = vi.fn();
    expect((await handleMobileFoodGateway(req(), 'pay', ENABLED, fetcher)).status).toBe(405);
    expect(
      (
        await handleMobileFoodGateway(
          request('pay', { headers: authorized() }),
          'pay',
          env,
          fetcher,
        )
      ).status,
    ).toBe(405);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('lost reply stays unknown with no automatic retry', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('lost'));
    const result = await handleMobileFoodGateway(req(), 'pay', env, fetcher);
    expect(result.status).toBe(503);
    expect(await result.json()).toMatchObject({ outcome: 'unknown' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
