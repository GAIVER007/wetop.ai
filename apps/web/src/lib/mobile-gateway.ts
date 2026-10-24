import { isIP } from 'node:net';

export type MobileGatewayEnv = Record<string, string | undefined>;
type MobileFetch = (input: string, init: RequestInit) => Promise<Response>;
type JsonRecord = Record<string, unknown>;

const REQUEST_LIMIT = 16_384;
const RESPONSE_LIMIT = 524_288;
const UPSTREAM_TIMEOUT_MS = 10_000;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const SCOPE = new RegExp(`^business=${UUID}(;location=${UUID})?$`, 'i');

const ACTIONS = {
  login: { method: 'POST', path: '/auth/login', authenticated: false },
  me: { method: 'GET', path: '/auth/me', authenticated: true, scope: true },
  organizations: { method: 'GET', path: '/auth/organizations', authenticated: true },
  organization: { method: 'POST', path: '/auth/organization', authenticated: true },
  branches: { method: 'GET', path: '/branches', authenticated: true, scope: true },
  logout: { method: 'POST', path: '/auth/logout', authenticated: true },
  'password-reset': { method: 'POST', path: '/auth/password-reset/request', authenticated: false },
} as const;

type MobileAction = keyof typeof ACTIONS;

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

function nullableString(value: unknown): string | null {
  if (value === null) return null;
  return string(value);
}

function optionalString(value: unknown): string | undefined {
  return value === undefined ? undefined : string(value);
}

function optionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new InvalidUpstreamResponse();
  return value;
}

function userDto(value: unknown): JsonRecord {
  const source = record(value);
  const result: JsonRecord = {
    id: string(source.id),
    email: string(source.email),
    name: nullableString(source.name),
    organizationId: string(source.organizationId),
    role: string(source.role),
  };
  const restricted = optionalBoolean(source.restricted);
  if (restricted !== undefined) result.restricted = restricted;
  if (source.scopes !== undefined) {
    if (!Array.isArray(source.scopes)) throw new InvalidUpstreamResponse();
    result.scopes = source.scopes.map((entry) => {
      const scope = record(entry);
      const filtered: JsonRecord = {
        role: string(scope.role),
        businessId: string(scope.businessId),
      };
      if (scope.locationId === null) filtered.locationId = null;
      else if (scope.locationId !== undefined) filtered.locationId = string(scope.locationId);
      return filtered;
    });
  }
  return result;
}

function sessionDto(value: unknown): JsonRecord {
  const source = record(value);
  return {
    token: nonEmptyString(source.token),
    expiresAt: nonEmptyString(source.expiresAt),
    user: userDto(source.user),
  };
}

function meDto(value: unknown): JsonRecord {
  const source = record(value);
  const result: JsonRecord = { user: source.user === null ? null : userDto(source.user) };
  if (source.organization !== undefined) {
    if (source.organization === null) result.organization = null;
    else {
      const organization = record(source.organization);
      result.organization = {
        name: string(organization.name),
        status: string(organization.status),
        trialEndsAt: organization.trialEndsAt === null ? null : string(organization.trialEndsAt),
      };
    }
  }
  for (const key of ['expiresAt', 'sessionIssuedAt', 'locale'] as const) {
    const valueAtKey = optionalString(source[key]);
    if (valueAtKey !== undefined) result[key] = valueAtKey;
  }
  if (source.context !== undefined && source.context !== null) {
    const context = record(source.context);
    result.context = {
      scope: context.scope === null || context.scope === undefined ? null : string(context.scope),
      businessId: context.businessId === null || context.businessId === undefined ? null : string(context.businessId),
      locationId: context.locationId === null || context.locationId === undefined ? null : string(context.locationId),
      vertical: context.vertical === null || context.vertical === undefined ? null : string(context.vertical),
    };
  } else if (source.context === null) result.context = null;
  if (source.access !== undefined) {
    const access = record(source.access);
    const aiSeller = record(access.aiSeller);
    result.access = { aiSeller: {
      access: string(aiSeller.access),
      status: aiSeller.status === null ? null : string(aiSeller.status),
      activeUntil: aiSeller.activeUntil === null ? null : string(aiSeller.activeUntil),
      daysLeft: aiSeller.daysLeft === null ? null : number(aiSeller.daysLeft),
    } };
  }
  if (source.beautyAccess !== undefined) result.beautyAccess = beautyAccessDto(source.beautyAccess);
  return result;
}

function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new InvalidUpstreamResponse();
  return value;
}

function beautyAccessDto(value: unknown): JsonRecord {
  const source = record(value);
  if (typeof source.assigned !== 'boolean' || !Array.isArray(source.permissions))
    throw new InvalidUpstreamResponse();
  return {
    mode: string(source.mode),
    assigned: source.assigned,
    permissions: source.permissions.map((entry) => {
      const permission = record(entry);
      return {
        section: string(permission.section),
        action: string(permission.action),
        scope: string(permission.scope),
      };
    }),
  };
}

function organizationsDto(value: unknown): JsonRecord {
  const source = record(value);
  if (!Array.isArray(source.organizations)) throw new InvalidUpstreamResponse();
  return { organizations: source.organizations.map((entry) => {
    const organization = record(entry);
    if (typeof organization.current !== 'boolean') throw new InvalidUpstreamResponse();
    return {
      id: string(organization.id),
      name: string(organization.name),
      role: string(organization.role),
      current: organization.current,
    };
  }) };
}

function branchesDto(value: unknown): JsonRecord {
  const source = record(value);
  if (!Array.isArray(source.items)) throw new InvalidUpstreamResponse();
  const result: JsonRecord = {
    items: source.items.map((entry) => {
      const branch = record(entry);
      const location = record(branch.location);
      return {
        id: string(branch.id),
        name: string(branch.name),
        currency: string(branch.currency),
        timezone: string(branch.timezone),
        vertical: string(branch.vertical),
        locationId: string(branch.locationId),
        location: { businessId: string(location.businessId) },
      };
    }),
  };
  const personal = optionalBoolean(source.personal);
  if (personal !== undefined) result.personal = personal;
  return result;
}

function okDto(value: unknown): JsonRecord {
  const source = record(value);
  if (typeof source.ok !== 'boolean') throw new InvalidUpstreamResponse();
  return { ok: source.ok };
}

function responseDto(action: MobileAction, value: unknown): JsonRecord {
  if (action === 'login' || action === 'organization') return sessionDto(value);
  if (action === 'me') return meDto(value);
  if (action === 'organizations') return organizationsDto(value);
  if (action === 'branches') return branchesDto(value);
  return okDto(value);
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

function trustedClientIp(request: Request, env: MobileGatewayEnv): string | null {
  // Включать только на входе, где Cloudflare всегда перезаписывает этот заголовок и прямой доступ к Next закрыт.
  // Без такого контракта пользовательский cf-connecting-ip не считается адресом клиента и в API не пересылается.
  if (env.MOBILE_GATEWAY_TRUSTED_PROXY !== 'cloudflare') return null;
  const value = request.headers.get('cf-connecting-ip')?.trim() ?? '';
  return value && value.length <= 45 && isIP(value) !== 0 ? value : null;
}

async function requestBody(request: Request, action: MobileAction): Promise<JsonRecord | Response> {
  if (request.method !== 'POST') return {};
  if (action === 'logout' && request.body === null) return {};
  const type = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!type.startsWith('application/json')) return json({ message: 'Нужен JSON' }, 415);
  const read = await readRequestText(request);
  if (!read.ok) {
    if (read.reason === 'timeout') return json({ message: 'Время ожидания запроса истекло' }, 408);
    if (read.reason === 'size') return json({ message: 'Слишком большой запрос' }, 413);
    return json({ message: 'Неверный запрос' }, 400);
  }
  let parsed: unknown;
  try { parsed = read.text ? JSON.parse(read.text) : {}; }
  catch { return json({ message: 'Неверный запрос' }, 400); }
  const source = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as JsonRecord : {};
  if (action === 'login') {
    const email = typeof source.email === 'string' ? source.email.trim() : '';
    const password = typeof source.password === 'string' ? source.password : '';
    if (!email || email.length > 320 || !password || password.length > 200)
      return json({ message: 'Введите почту и пароль' }, 400);
    return { email, password };
  }
  if (action === 'organization') {
    const organizationId = typeof source.organizationId === 'string' ? source.organizationId : '';
    if (!new RegExp(`^${UUID}$`, 'i').test(organizationId))
      return json({ message: 'Выберите доступную организацию' }, 400);
    return { organizationId };
  }
  if (action === 'password-reset') {
    const email = typeof source.email === 'string' ? source.email.trim() : '';
    if (!email || email.length > 320) return json({ message: 'Введите почту' }, 400);
    return { email };
  }
  return {};
}

type RequestRead =
  | { ok: true; text: string }
  | { ok: false; reason: 'size' | 'timeout' | 'read' };

async function readRequestText(request: Request): Promise<RequestRead> {
  const declared = request.headers.get('content-length');
  if (declared !== null) {
    const length = Number(declared);
    if (!Number.isInteger(length) || length < 0 || length > REQUEST_LIMIT)
      return { ok: false, reason: 'size' };
  }
  if (!request.body) return { ok: true, text: '' };
  const reader = request.body.getReader();
  const signal = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
  const cancel = () => { void reader.cancel().catch(() => undefined); };
  if (signal.aborted) {
    cancel();
    return { ok: false, reason: 'timeout' };
  }
  signal.addEventListener('abort', cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (signal.aborted) return { ok: false, reason: 'timeout' };
      if (done) break;
      total += value.byteLength;
      if (total > REQUEST_LIMIT) {
        await reader.cancel();
        return { ok: false, reason: 'size' };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: signal.aborted ? 'timeout' : 'read' };
  } finally {
    signal.removeEventListener('abort', cancel);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(bytes) };
}

function endpoint(env: MobileGatewayEnv, path: string): string | null {
  try {
    const base = new URL(env.APP_API_URL?.trim() || 'http://127.0.0.1:3001');
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash)
      return null;
    return `${base.toString().replace(/\/$/, '')}${path}`;
  } catch { return null; }
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
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

function errorMessage(action: MobileAction, status: number): string {
  if (status === 401) return action === 'login' ? 'Неверная почта или пароль' : 'Войдите заново';
  if (status === 403) return action === 'organization' ? 'Организация недоступна' : 'Недостаточно прав';
  if (status === 404) return 'Не найдено';
  if (status === 409) return 'Данные изменились. Обновите экран и попробуйте ещё раз.';
  if (status === 413) return 'Слишком большой запрос';
  if (status === 415) return 'Нужен JSON';
  if (status === 429) return 'Слишком много попыток. Попробуйте позже.';
  return 'Проверьте данные запроса';
}

export async function handleMobileGateway(
  request: Request,
  rawAction: string,
  env: MobileGatewayEnv,
  fetcher: MobileFetch = fetch,
): Promise<Response> {
  if (env.MOBILE_GATEWAY_ENABLED !== '1') return json({ message: 'Не найдено' }, 404);
  if (!Object.hasOwn(ACTIONS, rawAction)) return json({ message: 'Не найдено' }, 404);
  const action = rawAction as MobileAction;
  const entry = ACTIONS[action];
  if (request.method !== entry.method)
    return json({ message: 'Метод не поддерживается' }, 405, { allow: entry.method });
  if (hasServiceCredential(request)) return json({ message: 'Служебные ключи запрещены' }, 403);

  const clientIp = trustedClientIp(request, env);
  // Одного MOBILE_GATEWAY_ENABLED недостаточно. API намеренно не считает loopback без CF-адреса посетителя,
  // поэтому публичный вход и восстановление без подтверждённого ingress обошли бы предел попыток по IP.
  if ((action === 'login' || action === 'password-reset') && !clientIp)
    return json({ message: 'Вход временно недоступен' }, 503);

  const bearer = bearerOf(request);
  if (entry.authenticated && !bearer) return json({ message: 'Войдите заново' }, 401);
  const scope = request.headers.get('x-wetop-scope')?.trim() ?? '';
  if (scope && (!('scope' in entry) || !entry.scope || scope.length > 200 || !SCOPE.test(scope)))
    return json({ message: 'Некорректный рабочий контекст' }, 400);

  const body = await requestBody(request, action);
  if (body instanceof Response) return body;
  const url = endpoint(env, entry.path);
  if (!url) return json({ message: 'Сервис временно недоступен. Попробуйте ещё раз.' }, 503);

  const headers = new Headers({ accept: 'application/json' });
  if (request.method === 'POST') headers.set('content-type', 'application/json');
  if (bearer) headers.set('authorization', `Bearer ${bearer}`);
  if (scope) headers.set('x-wetop-scope', scope);
  const userAgent = request.headers.get('user-agent')?.trim();
  if (userAgent) headers.set('user-agent', userAgent.slice(0, 300));
  if (clientIp) headers.set('cf-connecting-ip', clientIp);

  let upstream: Response;
  try {
    upstream = await fetcher(url, {
      method: entry.method,
      headers,
      ...(entry.method === 'POST' ? { body: JSON.stringify(body) } : {}),
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
  try { parsed = text ? JSON.parse(text) : null; }
  catch { return json({ message: 'Некорректный ответ сервера' }, 502); }

  if (!upstream.ok) {
    if (upstream.status >= 500)
      return json({ message: 'Сервис временно недоступен. Попробуйте ещё раз.' }, 503);
    const status = [400, 401, 403, 404, 409, 413, 415, 422, 429].includes(upstream.status)
      ? upstream.status : 400;
    return json({ message: errorMessage(action, status) }, status);
  }

  try { return json(responseDto(action, parsed), 200); }
  catch { return json({ message: 'Некорректный ответ сервера' }, 502); }
}
