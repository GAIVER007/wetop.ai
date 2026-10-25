export type MobileFoodGatewayEnv = Record<string, string | undefined>;
type MobileFetch = (input: string, init: RequestInit) => Promise<Response>;
type JsonRecord = Record<string, unknown>;

const RESPONSE_LIMIT = 524_288;
const UPSTREAM_TIMEOUT_MS = 10_000;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const UUID_RE = new RegExp(`^${UUID}$`, 'i');
const LOCATION_SCOPE = new RegExp(`^business=${UUID};location=${UUID}$`, 'i');
const MINOR_UNITS = /^\d+$/;

const ACTIONS = {
  tables: '/food-service/waiter/tables',
  orders: '/food-service/orders',
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
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InvalidUpstreamResponse();
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
  if (!Number.isSafeInteger(value) || (value as number) < minimum) throw new InvalidUpstreamResponse();
  return value as number;
}

function minorUnits(value: unknown): string {
  const result = string(value);
  if (!MINOR_UNITS.test(result)) throw new InvalidUpstreamResponse();
  return result;
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

function bearerOf(request: Request): string | null {
  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return null;
  const token = authorization.slice(7);
  if (!token || token.length > 4096) return null;
  if ([...token].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 32 || code === 127;
  })) return null;
  return token;
}

function hasServiceCredential(request: Request): boolean {
  return ['x-wetop-service-key', 'x-service-key', 'x-api-key'].some((name) => request.headers.has(name));
}

function upstreamPath(request: Request, action: FoodAction): string | Response {
  const params = new URL(request.url).searchParams;
  if (action === 'tables') {
    if ([...params].length) return json({ message: 'Некорректный запрос' }, 400);
    return ACTIONS.tables;
  }
  const cursorValues = params.getAll('cursor');
  if ([...params.keys()].some((key) => key !== 'cursor') || cursorValues.length > 1)
    return json({ message: 'Некорректный запрос' }, 400);
  const cursor = cursorValues[0];
  if (cursor !== undefined && !UUID_RE.test(cursor)) return json({ message: 'Некорректный запрос' }, 400);
  const query = new URLSearchParams({ open: '1', limit: '100' });
  if (cursor) query.set('cursor', cursor);
  return `${ACTIONS.orders}?${query.toString()}`;
}

function endpoint(env: MobileFoodGatewayEnv, path: string): string | null {
  try {
    const base = new URL(env.APP_API_URL?.trim() || 'http://127.0.0.1:3001');
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash)
      return null;
    return `${base.toString().replace(/\/$/, '')}${path}`;
  } catch {
    return null;
  }
}

async function boundedResponse(response: Response): Promise<string | null> {
  const declared = response.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > RESPONSE_LIMIT)) return null;
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
  if (request.method !== 'GET') return json({ message: 'Метод не поддерживается' }, 405, { allow: 'GET' });
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
    return json(action === 'tables' ? tablesDto(parsed) : ordersDto(parsed), 200);
  } catch {
    return json({ message: 'Некорректный ответ сервера' }, 502);
  }
}
