import { cookies } from 'next/headers';
import { ApiError, authApi } from '../../../lib/api';
import { readBoundedText } from '../../../lib/bounded-body';
import { sessionCookieHeader } from '../../../lib/site-auth';
import { SESSION_COOKIE } from '../../../lib/session-cookie';
import { clearScopeCookieHeader, scopeResolvePath } from '../../../lib/scope-pointer';
import { msg } from '../../../i18n';
import { serverT } from '../../../i18n/server';

const refuse = async (text: string, status: number) => new Response((await serverT())(text), { status });

/**
 * Переход в другую свою организацию (один аккаунт в нескольких организациях, DATA_MODEL §13.5). Обычная форма и ответ
 * 303, как резервный вход: после смены ключа браузер сам проходит выбор филиала `/scope/resolve`. Серверное действие
 * здесь не годится: смена куки в нём перерисовывает страницу, и переход по обработчику маршрута не происходил.
 * Номер организации из формы только выбор: членство и состояние организации заново проверяет API.
 */
export async function POST(request: Request): Promise<Response> {
  const origin = new URL(process.env.APP_URL || request.url).origin;
  if (request.headers.get('origin') !== origin)
    return refuse(msg('Запрос не с приложения WETOP'), 403);
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/x-www-form-urlencoded')
    return refuse(msg('Нужна форма'), 415);
  const body = await readBoundedText(request, 1_024);
  if (!body.ok) return refuse(msg('Слишком большой запрос'), 413);
  const organizationId = (new URLSearchParams(body.text).get('organizationId') ?? '').trim();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const back = (reason: string) =>
    new Response(null, {
      status: 303,
      headers: { 'cache-control': 'no-store', location: `/profile/access?org=${reason}` },
    });
  if (!token) return back('signin');
  try {
    const next = await authApi.switchOrganization(token, organizationId, {
      ip: request.headers.get('cf-connecting-ip'),
      userAgent: request.headers.get('user-agent'),
    });
    const headers = new Headers({ 'cache-control': 'no-store', location: scopeResolvePath('/today') });
    headers.append('set-cookie', sessionCookieHeader(next, process.env));
    headers.append('set-cookie', clearScopeCookieHeader(process.env));
    return new Response(null, { status: 303, headers });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return back('signin');
    if (error instanceof ApiError && error.status === 403) return back('denied');
    return back('failed');
  }
}
