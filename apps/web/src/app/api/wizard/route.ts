import { ApiError, wizardApi, sellerAgentsApi } from '../../../lib/api';

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** Same-origin proxy for the guest draft only. No generic proxy and no auth-state mutation. */
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host') ?? new URL(request.url).host;
  // Next may use localhost in request.url behind its adapter; Host is the browser-facing authority.
  if (origin) {
    try {
      const source = new URL(origin);
      if (!['http:', 'https:'].includes(source.protocol) || source.host !== host)
        return json({ message: 'Недопустимый источник запроса' }, 403);
    } catch {
      return json({ message: 'Недопустимый источник запроса' }, 403);
    }
  }
  if (request.headers.get('sec-fetch-site') === 'cross-site')
    return json({ message: 'Недопустимый источник запроса' }, 403);
  const raw = await request.text();
  if (raw.length > 24000) return json({ message: 'Слишком большой запрос' }, 413);
  let body: {
    operation?: unknown;
    token?: unknown;
    ref?: unknown;
    config?: unknown;
    revision?: unknown;
    step?: unknown;
  };
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ message: 'Проверьте данные' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return json({ message: 'Проверьте данные' }, 400);
  if (body.token !== undefined && typeof body.token !== 'string')
    return json({ message: 'Сессия мастера недействительна' }, 401);
  const token = typeof body.token === 'string' ? body.token : '';
  if (token && !/^wz_[a-f0-9]{64}$/.test(token))
    return json({ message: 'Сессия мастера недействительна' }, 401);
  try {
    if (body.operation === 'claim') return json(await sellerAgentsApi.claim(token));
    if (body.operation === 'open')
      return json(
        await wizardApi.open(token, typeof body.ref === 'string' ? body.ref.slice(0, 200) : ''),
      );
    if (body.operation === 'save')
      return json(
        await wizardApi.save(token, {
          config: body.config,
          revision: body.revision,
          step: body.step,
        }),
      );
    return json({ message: 'Неизвестное действие' }, 400);
  } catch (error) {
    if (error instanceof ApiError) return json({ message: error.message }, error.status);
    throw error;
  }
}
