import { ApiError, wizardApi, sellerAgentsApi } from '../../../lib/api';
import { readBoundedText } from '../../../lib/bounded-body';
import { msg, translator } from '../../../i18n';
import { cookieLocale } from '../../../i18n/server';

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
/** Отказ гостю мастера на его языке (кука языка: сессии у гостя нет) */
const refuse = async (message: string, status: number) =>
  json({ message: translator(await cookieLocale())(message) }, status);

/** Same-origin proxy for the guest draft only. No generic proxy and no auth-state mutation. */
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host') ?? new URL(request.url).host;
  // Next may use localhost in request.url behind its adapter; Host is the browser-facing authority.
  if (origin) {
    try {
      const source = new URL(origin);
      if (!['http:', 'https:'].includes(source.protocol) || source.host !== host)
        return refuse(msg('Недопустимый источник запроса'), 403);
    } catch {
      return refuse(msg('Недопустимый источник запроса'), 403);
    }
  }
  if (request.headers.get('sec-fetch-site') === 'cross-site')
    return refuse(msg('Недопустимый источник запроса'), 403);
  // Потолок до чтения тела (аудит 29.09, SEC-4): 24 000 знаков русского текста — до 48 000 байт
  const read = await readBoundedText(request, 48_000);
  if (!read.ok) return refuse(msg('Слишком большой запрос'), 413);
  const raw = read.text;
  let body: {
    operation?: unknown;
    token?: unknown;
    ref?: unknown;
    config?: unknown;
    revision?: unknown;
    step?: unknown;
    answers?: unknown;
    type?: unknown;
    challenge?: unknown;
    text?: unknown;
    requestId?: unknown;
  };
  try {
    body = JSON.parse(raw);
  } catch {
    return refuse(msg('Проверьте данные'), 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return refuse(msg('Проверьте данные'), 400);
  if (body.token !== undefined && typeof body.token !== 'string')
    return refuse(msg('Сессия мастера недействительна'), 401);
  const token = typeof body.token === 'string' ? body.token : '';
  if (token && !/^wz_[a-f0-9]{64}$/.test(token))
    return refuse(msg('Сессия мастера недействительна'), 401);
  try {
    if (body.operation === 'message')
      return json(
        await wizardApi.message(
          token,
          {
            text: body.text,
            requestId: body.requestId,
            revision: body.revision,
            challenge: body.challenge,
          },
          request.headers.get('cf-connecting-ip'),
        ),
      );
    if (body.operation === 'generate')
      return json(
        await wizardApi.generate(
          token,
          { revision: body.revision, challenge: body.challenge },
          request.headers.get('cf-connecting-ip'),
        ),
      );
    if (body.operation === 'scan')
      return json(
        await wizardApi.scan(
          token,
          { revision: body.revision, challenge: body.challenge },
          request.headers.get('cf-connecting-ip'),
        ),
      );
    if (body.operation === 'scan-status') return json(await wizardApi.scanStatus(token));
    if (body.operation === 'claim') return json(await sellerAgentsApi.claim(token));
    if (body.operation === 'open')
      return json(
        await wizardApi.open(
          token,
          typeof body.ref === 'string' ? body.ref.slice(0, 200) : '',
          request.headers.get('cf-connecting-ip'),
        ),
      );
    if (body.operation === 'save')
      return json(
        await wizardApi.save(token, {
          config: body.config,
          revision: body.revision,
          step: body.step,
        }),
      );
    if (body.operation === 'survey') return json(await wizardApi.survey(token, body.answers));
    if (body.operation === 'event') return json(await wizardApi.event(token, { type: body.type }));
    return refuse(msg('Неизвестное действие'), 400);
  } catch (error) {
    if (error instanceof ApiError) return json({ message: error.message }, error.status);
    throw error;
  }
}
