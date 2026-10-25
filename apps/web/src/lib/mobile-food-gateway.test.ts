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
