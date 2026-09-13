import { getJsonPublic } from '../../../lib/api';

/**
 * Свежесть данных для строки в боковой панели (план wetop-live-data, шаг 4). Браузер к API напрямую
 * не ходит — стойка отдаёт ответ API как есть. GET-обработчик без Cache Components не кэшируется (Next 16).
 */
export async function GET() {
  try {
    return Response.json(await getJsonPublic('/system/freshness'));
  } catch {
    return Response.json({ error: 'Нет связи с API' }, { status: 503 });
  }
}
