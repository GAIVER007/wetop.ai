import { getJsonPublic } from '../../../lib/api';
import { currentMe } from '../../../lib/desk-shell';

/**
 * Касса филиала для шапки (CASH-SHIFTS-20261025). Чтение идёт GET-запросом, а не серверным действием: ответ
 * действия заново рисует страницу, и несохранённые правки экрана (например, порядок способов оплаты) сбрасывались
 * (гейт PR 864, settings-directories). `scope` сверяется с филиалом сессии, как в `assertScope`.
 */
export async function GET(request: Request) {
  const scope = new URL(request.url).searchParams.get('scope') ?? '';
  try {
    const me = await currentMe();
    if (!me.user || `${me.context?.businessId}:${me.context?.locationId}` !== scope)
      return Response.json({ error: 'Филиал изменился. Откройте кассу заново' }, { status: 409 });
    return Response.json(await getJsonPublic('/cash-register'));
  } catch {
    return Response.json({ error: 'Не удалось получить кассу' }, { status: 503 });
  }
}
