import { ApiError, sharedOnboardingApi } from '../../../../lib/api';
import { publicAuthUrl } from '../../../../lib/auth-entry';
import { readBoundedText } from '../../../../lib/bounded-body';

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
async function respond(read: () => Promise<unknown>) {
  try {
    return json({ state: await read() });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    // No raw API diagnostics, drafts or identity data in this recovery surface.
    return json({
      error: error.status >= 500 ? 'Нет связи с API. Введённые данные сохранены в форме. Повторите после восстановления связи.'
        : error.status === 409 ? 'Настройка изменена. Введённые данные остались в форме. Загрузите сохранённую версию.'
        : error.status === 403 ? 'Недостаточно прав для настройки.' : 'Не удалось выполнить запрос.',
      ...(error.status === 401 ? { loginUrl: publicAuthUrl() } : {}),
    }, error.status);
  }
}
export async function GET() {
  return respond(() => sharedOnboardingApi.status({ preserveUnauthorized: true }));
}
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(process.env.APP_URL || request.url).origin)
    return json({ error: 'Запрос из другого источника запрещён' }, 403);
  if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json')
    return json({ error: 'Нужен JSON' }, 415);
  const raw = await readBoundedText(request, 128 * 1024);
  if (!raw.ok) return json({ error: 'Слишком большой запрос' }, 413);
  let body: unknown;
  try { body = JSON.parse(raw.text); } catch { return json({ error: 'Некорректный JSON' }, 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Некорректная команда' }, 400);
  const command = body as Record<string, unknown>;
  if (typeof command.action !== 'string' || !['save', 'next', 'back', 'complete'].includes(command.action) ||
      !command.draft || typeof command.draft !== 'object' || Array.isArray(command.draft) ||
      !(command.updatedAt === null || typeof command.updatedAt === 'string'))
    return json({ error: 'Некорректная команда' }, 400);
  return respond(() => sharedOnboardingApi.save({
    action: command.action as 'save' | 'next' | 'back' | 'complete',
    draft: command.draft as Record<string, unknown>, updatedAt: command.updatedAt as string | null,
  }, { preserveUnauthorized: true }));
}
