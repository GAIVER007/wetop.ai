import { getJsonPublic } from '../../../lib/api';
import { currentMe } from '../../../lib/desk-shell';

/**
 * Выплаты дня для окна «Закрыть смену» (PAYROLL-DAILY-20261030): GET, как касса шапки (`../cash-register`).
 * `scope` сверяется с филиалом сессии. Нет права «Зарплата»: API отвечает отказом, окно идёт без раздела.
 */
export async function GET(request: Request) {
  const scope = new URL(request.url).searchParams.get('scope') ?? '';
  try {
    const me = await currentMe();
    if (!me.user || `${me.context?.businessId}:${me.context?.locationId}` !== scope)
      return Response.json({ error: 'scope-changed' }, { status: 409 });
    return Response.json(await getJsonPublic('/food-service/payroll/day'));
  } catch {
    return Response.json({ error: 'payroll-day-unavailable' }, { status: 503 });
  }
}
