import { ApiError, sharedOnboardingApi } from '../../../../lib/api';
import { publicAuthUrl } from '../../../../lib/auth-entry';
import { readBoundedText } from '../../../../lib/bounded-body';

async function respond(read: () => Promise<unknown>) {
  try {
    return Response.json({ state: await read() }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return Response.json(
      {
        error:
          error.status >= 500
            ? 'Нет связи с API. Введённые данные сохранены в форме. Повторите после восстановления связи.'
            : error.message,
        ...(error.status === 401 ? { loginUrl: publicAuthUrl() } : {}),
      },
      { status: error.status, headers: { 'cache-control': 'no-store' } },
    );
  }
}
export async function GET() {
  return respond(() => sharedOnboardingApi.status(true));
}
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(process.env.APP_URL || request.url).origin)
    return Response.json({ error: 'Запрос из другого источника запрещён' }, { status: 403 });
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json')
    return Response.json({ error: 'Нужен JSON' }, { status: 415 });
  // Above the backend's 32000-character draft limit even for UTF-8, but bounded before parsing.
  const raw = await readBoundedText(request, 128 * 1024);
  if (!raw.ok) return Response.json({ error: 'Слишком большой запрос' }, { status: 413 });
  let body: Parameters<typeof sharedOnboardingApi.save>[0];
  try {
    body = JSON.parse(raw.text);
  } catch {
    return Response.json({ error: 'Некорректный JSON' }, { status: 400 });
  }
  return respond(() => sharedOnboardingApi.save(body, true));
}
