import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ApiError, branchesApi } from '../../../lib/api';
import { publicAuthUrl } from '../../../lib/auth-entry';
import { SCOPE_COOKIE, scopeCookieOptions } from '../../../lib/scope-pointer';
import { decideScope, type SelectableBranch } from '../../../lib/scope-resolve';

export const dynamic = 'force-dynamic';

/**
 * Единый выбор рабочего филиала (SCOPE-HARDENING, решение владельца 06.10.2026): сюда ведут все входы по паролю и
 * экран с устаревшим указателем. Прежний указатель снимается до любого решения, затем сервер от имени текущей сессии
 * отдаёт доступные филиалы (`GET /branches`): один выбирается сам, при нескольких человек выбирает на `/branches`,
 * если нет ни одного, прежний путь настройки. Business и филиал из адреса не принимаются, только `next` как безопасный
 * локальный путь своего направления (`lib/scope-resolve.ts`).
 */
export async function GET(request: Request): Promise<Response> {
  const jar = await cookies();
  jar.delete(SCOPE_COOKIE);
  let items: SelectableBranch[] | null = null;
  try {
    items = (await branchesApi.list()).items;
  } catch (error) {
    if (!(error instanceof ApiError) || (error.status !== 401 && error.status !== 403)) throw error;
  }
  // `redirect` вызывается вне `try`: он бросает служебное исключение Next
  if (items === null) redirect(publicAuthUrl());
  const decision = decideScope(items, new URL(request.url).searchParams.get('next'));
  if (decision.kind === 'select')
    jar.set(SCOPE_COOKIE, decision.pointer, scopeCookieOptions(process.env));
  redirect(decision.target);
}
