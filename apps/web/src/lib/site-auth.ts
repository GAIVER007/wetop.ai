import { ApiError } from './api-error';
import type { AuthClientInfo } from './api';
import { SESSION_COOKIE, cookieSecure } from './session-cookie';

/**
 * Вход и регистрация окном на wetop.ai (plans/site-auth-dialog-tour-2026-09-27.md, Д1, ADR-100).
 *
 * Сайт статический и собственного сервера не имеет, поэтому окно шлёт `fetch` на стойку с `credentials: 'include'`.
 * wetop.ai и app.wetop.ai — один сайт (same-site): кука стойки `SameSite=Lax` ставится ответом на такой запрос, и
 * после перехода на `app.wetop.ai` человек уже вошёл. Ключ сессии в тело ответа не попадает — только в `HttpOnly`-куку.
 *
 * Защита от чужих страниц: ответ только своим источникам (`SITE_ORIGINS`), запрос без `Origin` или с чужим —
 * 403 до обращения к API, тело — только JSON (браузер с чужой страницы без предварительного запроса такое не пошлёт).
 * Пределы попыток — прежние: API считает их по адресу посетителя, он уходит заголовком, как у серверного действия.
 */

type Env = Record<string, string | undefined>;

const DEFAULT_ORIGINS = ['https://wetop.ai', 'https://www.wetop.ai'];
/** Сайт в разработке: `npm run dev -w apps/site` (apps/README.md) */
const DEV_ORIGINS = ['http://127.0.0.1:3002', 'http://localhost:3002'];

const NO_CONNECTION = 'Нет связи с сервером. Попробуйте ещё раз.';

/** Источники, которым стойка отвечает. `SITE_ORIGINS` — через запятую; пусто — wetop.ai и www.wetop.ai. */
export function siteOrigins(env: Env): string[] {
  const listed = (env.SITE_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const base = listed.length > 0 ? listed : DEFAULT_ORIGINS;
  return env.NODE_ENV === 'production' ? base : [...new Set([...base, ...DEV_ORIGINS])];
}

export interface SiteSession {
  token: string;
  expiresAt: string;
}

/** Что вернуло действие: тело для окна и, если вход удался, сессия — она станет кукой. */
export interface SiteAuthResult {
  body: Record<string, unknown>;
  session?: SiteSession;
}

export type SiteAuthAction = (body: unknown, info: AuthClientInfo) => Promise<SiteAuthResult>;

/** Та же кука, что ставит серверное действие входа (`lib/session.ts`): имя, путь, `HttpOnly`, `Lax`, срок от API. */
export function sessionCookieHeader(session: SiteSession, env: Env): string {
  const parts = [`${SESSION_COOKIE}=${encodeURIComponent(session.token)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  const expires = new Date(session.expiresAt);
  if (!Number.isNaN(expires.getTime())) parts.push(`Expires=${expires.toUTCString()}`);
  if (cookieSecure(env)) parts.push('Secure');
  return parts.join('; ');
}

function corsHeaders(origin: string): Headers {
  return new Headers({
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '600',
    vary: 'Origin',
    'cache-control': 'no-store',
  });
}

function json(body: unknown, status: number, headers: Headers): Response {
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { status, headers });
}

function clientInfoOf(request: Request): AuthClientInfo {
  return {
    ip: request.headers.get('cf-connecting-ip')?.trim() || null,
    userAgent: request.headers.get('user-agent')?.trim() || null,
  };
}

/**
 * Один обработчик на все пути окна: OPTIONS — разрешение, GET — действие без тела, POST — действие с JSON-телом.
 * Ошибка API уходит своим кодом и текстом; любой другой сбой — 503 одной фразой (подробности сети наружу не нужны).
 */
export async function handleSiteAuth(request: Request, action: SiteAuthAction, env: Env): Promise<Response> {
  const origin = request.headers.get('origin')?.trim() ?? '';
  if (!origin || !siteOrigins(env).includes(origin)) {
    return json({ message: 'Запрос не с сайта WETOP' }, 403, new Headers({ vary: 'Origin' }));
  }
  const headers = corsHeaders(origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  let body: unknown = null;
  if (request.method === 'POST') {
    const type = request.headers.get('content-type') ?? '';
    if (!type.toLowerCase().startsWith('application/json')) {
      return json({ message: 'Нужен JSON' }, 415, headers);
    }
    try {
      body = await request.json();
    } catch {
      return json({ message: 'Неверный запрос' }, 400, headers);
    }
  }

  try {
    const result = await action(body, clientInfoOf(request));
    if (result.session) headers.append('set-cookie', sessionCookieHeader(result.session, env));
    return json(result.body, 200, headers);
  } catch (error) {
    if (error instanceof ApiError) return json({ message: error.message }, error.status, headers);
    return json({ message: NO_CONNECTION }, 503, headers);
  }
}

/** Строка из тела запроса: окно шлёт поля строками, всё прочее — пусто, а пустое API отклонит своими словами. */
export function field(body: unknown, key: string): string {
  if (!body || typeof body !== 'object') return '';
  const value = (body as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}
