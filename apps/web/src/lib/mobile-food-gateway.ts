export type MobileFoodGatewayEnv = Record<string, string | undefined>;
type MobileFetch = (input: string, init: RequestInit) => Promise<Response>;
type JsonRecord = Record<string, unknown>;

const RESPONSE_LIMIT = 524_288;
const UPSTREAM_TIMEOUT_MS = 10_000;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const UUID_RE = new RegExp(`^${UUID}$`, 'i');
const LOCATION_SCOPE = new RegExp(`^business=${UUID};location=${UUID}$`, 'i');
const MINOR_UNITS = /^\d+$/;
const SIGNED_MINOR_UNITS = /^-?\d+$/;

const ACTIONS = {
  tables: '/food-service/waiter/tables',
  orders: '/food-service/orders',
  categories: '/food-service/menu/categories',
  items: '/food-service/menu/items',
  cash: '/food-service/cash',
  overview: '/food-service/report',
  analytics: '/food-service/period-report',
  shifts: '/food-service/shifts',
  'staff-revenue': '/food-service/staff-revenue',
} as const;

type FoodAction = keyof typeof ACTIONS;

class InvalidUpstreamResponse extends Error {}

function json(body: unknown, status: number, extra: HeadersInit = {}): Response {
  return Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store', ...Object.fromEntries(new Headers(extra)) },
  });
}

function record(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new InvalidUpstreamResponse();
  return value as JsonRecord;
}

function string(value: unknown): string {
  if (typeof value !== 'string') throw new InvalidUpstreamResponse();
  return value;
}

function nonEmptyString(value: unknown): string {
  const result = string(value);
  if (!result) throw new InvalidUpstreamResponse();
  return result;
}

function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new InvalidUpstreamResponse();
  return value;
}

function integer(value: unknown, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum)
    throw new InvalidUpstreamResponse();
  return value as number;
}

function minorUnits(value: unknown): string {
  const result = string(value);
  if (!MINOR_UNITS.test(result)) throw new InvalidUpstreamResponse();
  return result;
}

function signedMinorUnits(value: unknown): string {
  const result = string(value);
  if (!SIGNED_MINOR_UNITS.test(result)) throw new InvalidUpstreamResponse();
  return result;
}

function nullableInteger(value: unknown, minimum = 0): number | null {
  return value === null ? null : integer(value, minimum);
}

function nullableNonEmptyString(value: unknown): string | null {
  return value === null ? null : nonEmptyString(value);
}

function station(value: unknown): 'KITCHEN' | 'BAR' {
  if (value !== 'KITCHEN' && value !== 'BAR') throw new InvalidUpstreamResponse();
  return value;
}

function nullableNamed(value: unknown): JsonRecord | null {
  if (value === null) return null;
  const source = record(value);
  return { id: nonEmptyString(source.id), name: nonEmptyString(source.name) };
}

function tablesDto(value: unknown): JsonRecord {
  const source = record(value);
  if (!Array.isArray(source.tables)) throw new InvalidUpstreamResponse();
  return {
    me: nullableNamed(source.me),
    tables: source.tables.map((entry) => {
      const table = record(entry);
      return {
        id: nonEmptyString(table.id),
        name: nonEmptyString(table.name),
        capacity: integer(table.capacity, 1),
        areaName: nonEmptyString(table.areaName),
        busy: boolean(table.busy),
        mine: boolean(table.mine),
        needsCleaning: boolean(table.needsCleaning),
      };
    }),
  };
}

function orderItemDto(value: unknown): JsonRecord {
  const item = record(value);
  return {
    id: nonEmptyString(item.id),
    name: nonEmptyString(item.name),
    qty: integer(item.qty, 1),
    status: nonEmptyString(item.status),
    station: nonEmptyString(item.station),
    priceMinor: minorUnits(item.priceMinor),
  };
}

function orderDto(value: unknown): JsonRecord {
  const order = record(value);
  if (!Array.isArray(order.items)) throw new InvalidUpstreamResponse();
  return {
    id: nonEmptyString(order.id),
    number: integer(order.number, 1),
    status: nonEmptyString(order.status),
    table: nullableNamed(order.table),
    waiter: nullableNamed(order.waiter),
    guestCount: integer(order.guestCount, 1),
    totalMinor: minorUnits(order.totalMinor),
    paidMinor: minorUnits(order.paidMinor),
    currency: nonEmptyString(order.currency),
    updatedAt: nonEmptyString(order.updatedAt),
    delayed: boolean(order.delayed),
    items: order.items.map(orderItemDto),
  };
}

function ordersDto(value: unknown): JsonRecord {
  const source = record(value);
  if (!Array.isArray(source.items)) throw new InvalidUpstreamResponse();
  const nextCursor = source.nextCursor;
  if (nextCursor !== null && (typeof nextCursor !== 'string' || !UUID_RE.test(nextCursor)))
    throw new InvalidUpstreamResponse();
  return { items: source.items.map(orderDto), nextCursor };
}

function cashDto(value: unknown): JsonRecord {
  const source = record(value);
  if (!Array.isArray(source.balances) || !Array.isArray(source.payments))
    throw new InvalidUpstreamResponse();
  return {
    currency: nonEmptyString(source.currency),
    balances: source.balances.map((value) => {
      const balance = record(value);
      return {
        method: nonEmptyString(balance.method),
        balanceMinor: signedMinorUnits(balance.balanceMinor),
      };
    }),
    payments: source.payments.map((value) => {
      const payment = record(value);
      return {
        id: nonEmptyString(payment.id),
        orderNumber: integer(payment.orderNumber, 1),
        method: nonEmptyString(payment.method),
        amountMinor: minorUnits(payment.amountMinor),
        status: nonEmptyString(payment.status),
        paidAt: nonEmptyString(payment.paidAt),
      };
    }),
  };
}

function dateText(value: unknown): string {
  const date = string(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new InvalidUpstreamResponse();
  const parsed = new Date(date);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date)
    throw new InvalidUpstreamResponse();
  return date;
}

function overviewDto(value: unknown): JsonRecord {
  const source = record(value);
  const tiles = record(source.tiles);
  return {
    date: dateText(source.date),
    currency: nonEmptyString(source.currency),
    tiles: {
      tablesOccupied: integer(tiles.tablesOccupied),
      tablesTotal: integer(tiles.tablesTotal),
      ordersCount: integer(tiles.ordersCount),
      revenueMinor: minorUnits(tiles.revenueMinor),
      kitchenQueue: integer(tiles.kitchenQueue),
      kitchenAvgWaitMinutes:
        tiles.kitchenAvgWaitMinutes === null ? null : integer(tiles.kitchenAvgWaitMinutes),
      staffOnShift: integer(tiles.staffOnShift),
      staffTotal: integer(tiles.staffTotal),
    },
  };
}

function analyticsDto(value: unknown): JsonRecord {
  const source = record(value);
  if (
    !Array.isArray(source.payments) ||
    !Array.isArray(source.topDishes) ||
    !Array.isArray(source.revenueByDay) ||
    !Array.isArray(source.waiters)
  )
    throw new InvalidUpstreamResponse();
  const stationRanks = record(source.topByStation);
  function stationItems(value: unknown): JsonRecord[] {
    if (!Array.isArray(value) || value.length > 3) throw new InvalidUpstreamResponse();
    return value.map((entry) => {
      const row = record(entry);
      return {
        name: nonEmptyString(row.name),
        qty: integer(row.qty),
        revenueMinor: minorUnits(row.revenueMinor),
      };
    });
  }
  return {
    from: dateText(source.from),
    to: dateText(source.to),
    currency: nonEmptyString(source.currency),
    ordersCount: integer(source.ordersCount),
    revenueMinor: minorUnits(source.revenueMinor),
    averageCheckMinor:
      source.averageCheckMinor === null ? null : minorUnits(source.averageCheckMinor),
    payments: source.payments.map((value) => {
      const row = record(value);
      return {
        method: nonEmptyString(row.method),
        amountMinor: minorUnits(row.amountMinor),
        count: integer(row.count),
      };
    }),
    topDishes: source.topDishes.map((value) => {
      const row = record(value);
      return {
        name: nonEmptyString(row.name),
        qty: integer(row.qty),
        revenueMinor: minorUnits(row.revenueMinor),
      };
    }),
    topByStation: {
      KITCHEN: stationItems(stationRanks.KITCHEN),
      BAR: stationItems(stationRanks.BAR),
    },
    revenueByDay: source.revenueByDay.map((value) => {
      const row = record(value);
      return {
        date: dateText(row.date),
        revenueMinor: minorUnits(row.revenueMinor),
        orders: integer(row.orders),
      };
    }),
    waiters: source.waiters.map((value) => {
      const row = record(value);
      return {
        name: nonEmptyString(row.name),
        orders: integer(row.orders),
        revenueMinor: minorUnits(row.revenueMinor),
      };
    }),
  };
}

function nextCursorOf(source: JsonRecord): string | null {
  const nextCursor = source.nextCursor;
  if (nextCursor !== null && (typeof nextCursor !== 'string' || !UUID_RE.test(nextCursor)))
    throw new InvalidUpstreamResponse();
  return nextCursor;
}

function categoriesDto(value: unknown): JsonRecord {
  const source = record(value);
  if (!Array.isArray(source.items)) throw new InvalidUpstreamResponse();
  return {
    items: source.items.map((entry) => {
      const category = record(entry);
      return {
        id: nonEmptyString(category.id),
        name: nonEmptyString(category.name),
        sortOrder: integer(category.sortOrder, Number.MIN_SAFE_INTEGER),
        active: boolean(category.active),
        station: station(category.station),
      };
    }),
    nextCursor: nextCursorOf(source),
  };
}

function modifierGroupDto(value: unknown): JsonRecord {
  const group = record(value);
  if (!Array.isArray(group.modifiers)) throw new InvalidUpstreamResponse();
  const minSelect = integer(group.minSelect);
  const maxSelect = integer(group.maxSelect, 1);
  const required = boolean(group.required);
  if (minSelect > maxSelect || required !== minSelect >= 1) throw new InvalidUpstreamResponse();
  return {
    id: nonEmptyString(group.id),
    name: nonEmptyString(group.name),
    minSelect,
    maxSelect,
    required,
    modifiers: group.modifiers.map((entry) => {
      const modifier = record(entry);
      return {
        id: nonEmptyString(modifier.id),
        name: nonEmptyString(modifier.name),
        priceDeltaMinor: signedMinorUnits(modifier.priceDeltaMinor),
      };
    }),
  };
}

function menuItemDto(value: unknown): JsonRecord {
  const item = record(value);
  if (!Array.isArray(item.modifierGroups)) throw new InvalidUpstreamResponse();
  return {
    id: nonEmptyString(item.id),
    categoryId: nonEmptyString(item.categoryId),
    name: nonEmptyString(item.name),
    weightGrams: nullableInteger(item.weightGrams, 1),
    priceMinor: minorUnits(item.priceMinor),
    currency: nonEmptyString(item.currency),
    active: boolean(item.active),
    sortOrder: integer(item.sortOrder, Number.MIN_SAFE_INTEGER),
    updatedAt: nonEmptyString(item.updatedAt),
    photoUrl: nullableNonEmptyString(item.photoUrl),
    modifierGroups: item.modifierGroups.map(modifierGroupDto),
  };
}

function menuItemsDto(value: unknown): JsonRecord {
  const source = record(value);
  if (!Array.isArray(source.items)) throw new InvalidUpstreamResponse();
  return { items: source.items.map(menuItemDto), nextCursor: nextCursorOf(source) };
}

function shiftsDto(value: unknown): JsonRecord {
  const source = record(value);
  if (!Array.isArray(source.employees)) throw new InvalidUpstreamResponse();
  return {
    employees: source.employees.map((entry) => {
      const employee = record(entry);
      if (!Array.isArray(employee.week)) throw new InvalidUpstreamResponse();
      return {
        id: nonEmptyString(employee.id),
        name: nonEmptyString(employee.name),
        week: employee.week.map((dayValue) => {
          const day = record(dayValue);
          if (!Array.isArray(day.intervals)) throw new InvalidUpstreamResponse();
          return {
            weekday: integer(day.weekday),
            intervals: day.intervals.map((value) => {
              const interval = record(value);
              const timeFrom = nonEmptyString(interval.timeFrom);
              const timeTo = nonEmptyString(interval.timeTo);
              if (
                !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeFrom) ||
                !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeTo)
              )
                throw new InvalidUpstreamResponse();
              return { timeFrom, timeTo };
            }),
          };
        }),
      };
    }),
  };
}

function staffRevenueDto(value: unknown): JsonRecord {
  const source = record(value);
  if (!['day', 'week', 'month'].includes(string(source.period)) || !Array.isArray(source.items))
    throw new InvalidUpstreamResponse();
  return {
    period: source.period,
    fromDate: dateText(source.fromDate),
    toDate: dateText(source.toDate),
    items: source.items.map((entry) => {
      const row = record(entry);
      const paidMinor = minorUnits(row.paidMinor);
      const refundedMinor = minorUnits(row.refundedMinor);
      const netMinor = signedMinorUnits(row.netMinor);
      if (BigInt(paidMinor) - BigInt(refundedMinor) !== BigInt(netMinor))
        throw new InvalidUpstreamResponse();
      return {
        employeeId: row.employeeId === null ? null : nonEmptyString(row.employeeId),
        currency: nonEmptyString(row.currency),
        paidMinor,
        refundedMinor,
        netMinor,
      };
    }),
  };
}

function bearerOf(request: Request): string | null {
  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return null;
  const token = authorization.slice(7);
  if (!token || token.length > 4096) return null;
  if (
    [...token].some((character) => {
      const code = character.charCodeAt(0);
      return code <= 32 || code === 127;
    })
  )
    return null;
  return token;
}

function hasServiceCredential(request: Request): boolean {
  return ['x-wetop-service-key', 'x-service-key', 'x-api-key'].some((name) =>
    request.headers.has(name),
  );
}

function upstreamPath(request: Request, action: FoodAction): string | Response {
  const params = new URL(request.url).searchParams;
  if (action === 'tables' || action === 'cash' || action === 'shifts') {
    if ([...params].length) return json({ message: 'Некорректный запрос' }, 400);
    return ACTIONS[action];
  }
  if (action === 'staff-revenue') {
    if (params.getAll('period').length !== 1 || [...params.keys()].some((key) => key !== 'period'))
      return json({ message: 'Некорректный период' }, 400);
    const period = params.get('period');
    if (period !== 'day' && period !== 'week' && period !== 'month')
      return json({ message: 'Некорректный период' }, 400);
    return `${ACTIONS['staff-revenue']}?period=${period}`;
  }
  if (action === 'overview' || action === 'analytics') {
    const required = action === 'overview' ? ['date'] : ['from', 'to'];
    if (
      [...params.keys()].some((key) => !required.includes(key)) ||
      required.some((key) => params.getAll(key).length !== 1)
    )
      return json({ message: 'Некорректный период' }, 400);
    try {
      if (action === 'overview') return `${ACTIONS.overview}?date=${dateText(params.get('date'))}`;
      const from = dateText(params.get('from'));
      const to = dateText(params.get('to'));
      if (from > to || (Date.parse(to) - Date.parse(from)) / 86_400_000 > 92)
        throw new InvalidUpstreamResponse();
      return `${ACTIONS.analytics}?from=${from}&to=${to}`;
    } catch {
      return json({ message: 'Некорректный период' }, 400);
    }
  }
  const cursorValues = params.getAll('cursor');
  if ([...params.keys()].some((key) => key !== 'cursor') || cursorValues.length > 1)
    return json({ message: 'Некорректный запрос' }, 400);
  const cursor = cursorValues[0];
  if (cursor !== undefined && !UUID_RE.test(cursor))
    return json({ message: 'Некорректный запрос' }, 400);
  const query = new URLSearchParams(
    action === 'orders' ? { open: '1', limit: '100' } : { limit: '100' },
  );
  if (cursor) query.set('cursor', cursor);
  return `${ACTIONS[action]}?${query.toString()}`;
}

function endpoint(env: MobileFoodGatewayEnv, path: string): string | null {
  try {
    const base = new URL(env.APP_API_URL?.trim() || 'http://127.0.0.1:3001');
    if (
      !['http:', 'https:'].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    )
      return null;
    return `${base.toString().replace(/\/$/, '')}${path}`;
  } catch {
    return null;
  }
}

async function boundedResponse(response: Response): Promise<string | null> {
  const declared = response.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > RESPONSE_LIMIT))
    return null;
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > RESPONSE_LIMIT) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function errorMessage(status: number): string {
  if (status === 401) return 'Войдите заново';
  if (status === 403) return 'Недостаточно прав';
  if (status === 404) return 'Не найдено';
  if (status === 429) return 'Слишком много запросов. Попробуйте позже.';
  return 'Проверьте данные запроса';
}

export async function handleMobileFoodGateway(
  request: Request,
  rawAction: string,
  env: MobileFoodGatewayEnv,
  fetcher: MobileFetch = fetch,
): Promise<Response> {
  if (env.MOBILE_GATEWAY_ENABLED !== '1') return json({ message: 'Не найдено' }, 404);
  if (!Object.hasOwn(ACTIONS, rawAction)) return json({ message: 'Не найдено' }, 404);
  const action = rawAction as FoodAction;
  if (request.method !== 'GET')
    return json({ message: 'Метод не поддерживается' }, 405, { allow: 'GET' });
  if (hasServiceCredential(request)) return json({ message: 'Служебные ключи запрещены' }, 403);

  const bearer = bearerOf(request);
  if (!bearer) return json({ message: 'Войдите заново' }, 401);
  const scope = request.headers.get('x-wetop-scope')?.trim() ?? '';
  if (scope.length > 200 || !LOCATION_SCOPE.test(scope))
    return json({ message: 'Некорректный рабочий контекст' }, 400);

  const path = upstreamPath(request, action);
  if (path instanceof Response) return path;
  const url = endpoint(env, path);
  if (!url) return json({ message: 'Сервис временно недоступен. Попробуйте ещё раз.' }, 503);

  const headers = new Headers({
    accept: 'application/json',
    authorization: `Bearer ${bearer}`,
    'x-wetop-scope': scope,
  });
  const userAgent = request.headers.get('user-agent')?.trim();
  if (userAgent) headers.set('user-agent', userAgent.slice(0, 300));

  let upstream: Response;
  try {
    upstream = await fetcher(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return json({ message: 'Нет связи с сервером. Попробуйте ещё раз.' }, 503);
  }

  const text = await boundedResponse(upstream).catch(() => null);
  if (text === null) return json({ message: 'Некорректный ответ сервера' }, 502);
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    return json({ message: 'Некорректный ответ сервера' }, 502);
  }

  if (!upstream.ok) {
    if (upstream.status >= 500)
      return json({ message: 'Сервис временно недоступен. Попробуйте ещё раз.' }, 503);
    const status = [400, 401, 403, 404, 422, 429].includes(upstream.status) ? upstream.status : 400;
    return json({ message: errorMessage(status) }, status);
  }

  try {
    if (action === 'tables') return json(tablesDto(parsed), 200);
    if (action === 'orders') return json(ordersDto(parsed), 200);
    if (action === 'categories') return json(categoriesDto(parsed), 200);
    if (action === 'cash') return json(cashDto(parsed), 200);
    if (action === 'overview') return json(overviewDto(parsed), 200);
    if (action === 'analytics') return json(analyticsDto(parsed), 200);
    if (action === 'shifts') return json(shiftsDto(parsed), 200);
    if (action === 'staff-revenue') return json(staffRevenueDto(parsed), 200);
    return json(menuItemsDto(parsed), 200);
  } catch {
    return json({ message: 'Некорректный ответ сервера' }, 502);
  }
}
