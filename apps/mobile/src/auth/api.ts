import {
  AccessError,
  type AccessApi,
  type Branch,
  type Branches,
  type Login,
  type Me,
  type Organization,
  type User,
} from './contracts';
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AccessError('invalid');
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== 'string') throw new AccessError('invalid');
  return value;
}
function user(value: unknown): User {
  const v = record(value);
  return {
    id: string(v.id),
    name: v.name === null ? null : string(v.name),
    email: string(v.email),
    role: string(v.role),
    organizationId: string(v.organizationId),
  };
}
function login(value: unknown): Login {
  const v = record(value);
  if (!v.token || !v.expiresAt) throw new AccessError('invalid');
  return { token: string(v.token), expiresAt: string(v.expiresAt), user: user(v.user) };
}
function array<T>(value: unknown, read: (v: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new AccessError('invalid');
  return value.map(read);
}
function branch(value: unknown): Branch {
  const v = record(value);
  return {
    id: string(v.id),
    name: string(v.name),
    currency: string(v.currency),
    timezone: string(v.timezone),
    vertical: string(v.vertical),
    locationId: string(v.locationId),
    location: { businessId: string(record(v.location).businessId) },
  };
}
export function createAccessApi(base: string, fetcher: typeof fetch = fetch): AccessApi {
  async function request(
    action: string,
    method: string,
    token?: string,
    body?: unknown,
    scope?: string,
  ): Promise<unknown> {
    let url: URL;
    try {
      url = new URL(base);
    } catch {
      throw new AccessError('configuration');
    }
    const local = __DEV__ && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (!local && url.protocol !== 'https:') ||
      (local && !['http:', 'https:'].includes(url.protocol))
    )
      throw new AccessError('configuration');
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 12000);
    try {
      const response = await fetcher(`${base.replace(/\/$/, '')}/${action}`, {
        method,
        signal: abort.signal,
        redirect: 'error',
        credentials: 'omit',
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(scope ? { 'X-Wetop-Scope': scope } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok)
        throw new AccessError(
          response.status === 401
            ? 'unauthorized'
            : response.status === 403
              ? 'forbidden'
              : response.status === 429
                ? 'limited'
                : response.status === 503
                  ? 'configuration'
                  : 'network',
        );
      const text = await response.text();
      if (text.length > 524288) throw new AccessError('invalid');
      try {
        return JSON.parse(text);
      } catch {
        throw new AccessError('invalid');
      }
    } catch (error) {
      if (error instanceof AccessError) throw error;
      throw new AccessError('network');
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    login: async (email, password) =>
      login(await request('login', 'POST', undefined, { email, password })),
    me: async (token, scope): Promise<Me> => {
      const v = record(await request('me', 'GET', token, undefined, scope));
      if (v.user === null) return { user: null };
      const c = v.context ? record(v.context) : undefined;
      return {
        user: user(v.user),
        ...(typeof v.sessionIssuedAt === 'string' ? { sessionIssuedAt: v.sessionIssuedAt } : {}),
        ...(c
          ? {
              context: {
                businessId: c.businessId === null ? null : string(c.businessId),
                locationId: c.locationId === null ? null : string(c.locationId),
                vertical: c.vertical === null ? null : string(c.vertical),
              },
            }
          : {}),
      };
    },
    branches: async (token): Promise<Branches> => {
      const v = record(await request('branches', 'GET', token));
      return { items: array(v.items, branch), personal: v.personal === true };
    },
    organizations: async (token) => {
      const v = record(await request('organizations', 'GET', token));
      return array(v.organizations, (value): Organization => {
        const o = record(value);
        return {
          id: string(o.id),
          name: string(o.name),
          role: string(o.role),
          current: o.current === true,
        };
      });
    },
    switchOrganization: async (token, id) =>
      login(await request('organization', 'POST', token, { organizationId: id })),
    logout: async (token) => {
      await request('logout', 'POST', token);
    },
    report: (token, scope, action, from, to) =>
      request(
        `food/${action}?${action === 'overview' ? `date=${encodeURIComponent(from)}` : `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to ?? '')}`}`,
        'GET',
        token,
        undefined,
        scope,
      ),
    food: (token, scope, action, cursor) =>
      request(
        `food/${action}${cursor ? '?cursor=' + encodeURIComponent(cursor) : ''}`,
        'GET',
        token,
        undefined,
        scope,
      ),
    staffRevenue: (token, scope, period) =>
      request(`food/staff-revenue?period=${period}`, 'GET', token, undefined, scope),
    createOrder: (token, scope, payload) => request('food/orders', 'POST', token, payload, scope),
    serveItem: (token, scope, orderId, itemId, expectedUpdatedAt) =>
      request('food/serve', 'POST', token, { orderId, itemId, expectedUpdatedAt }, scope),
    closeOrder: (token, scope, orderId, expectedUpdatedAt) =>
      request('food/close', 'POST', token, { orderId, expectedUpdatedAt }, scope),
    payOrder: (token, scope, payload) => request('food/pay', 'POST', token, payload, scope),
    reset: async (email) => {
      await request('password-reset', 'POST', undefined, { email });
    },
  };
}
