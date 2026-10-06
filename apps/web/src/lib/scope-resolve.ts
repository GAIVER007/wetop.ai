import { safeReturnPath } from './auth-entry';
import { scopeHeader } from './scope-pointer';
import { landingForVertical, routeVertical, type WebVertical } from './vertical-landing';

/**
 * Выбор рабочего филиала после входа и после устаревшего указателя (SCOPE-HARDENING, решение владельца 06.10.2026).
 * Источник один: ответ сервера `GET /branches` от имени текущей сессии. Значения Business и филиала из адреса, тела
 * запроса или прежней куки не берутся.
 *
 * - филиалов нет: прежний путь настройки (`/onboarding`);
 * - филиал один: выбирается сам;
 * - филиалов несколько: человек выбирает сам на `/branches`, «первый попавшийся» не выбирается никогда.
 *
 * Регистрационный помощник `/auth/registration-context` здесь не используется: он завершает первую регистрацию и
 * рабочий филиал в организации с несколькими бизнесами не выбирает.
 */
export interface SelectableBranch {
  vertical: WebVertical;
  locationId: string;
  location: { businessId: string };
}

export type ScopeDecision =
  | { kind: 'select'; pointer: string; target: string }
  | { kind: 'choose'; target: '/branches' }
  | { kind: 'empty'; target: '/onboarding' };

/** Разделы, общие для всех направлений: их меню есть и у салона, и у ресторана */
const SHARED = ['/journal', '/help', '/profile', '/staff', '/team'];

function compatible(path: string, vertical: WebVertical): boolean {
  const pathname = path.split('?')[0]!;
  if (SHARED.some((root) => pathname === root || pathname.startsWith(`${root}/`))) return true;
  const owner = routeVertical(pathname);
  if (owner) return owner === vertical;
  // Клиенты общие у салона и ресторана; прочие неразмеченные разделы стойки гостиничные
  if (pathname === '/customers' || pathname.startsWith('/customers/'))
    return vertical !== 'HOSPITALITY';
  return vertical === 'HOSPITALITY';
}

/**
 * Куда вести после выбора. `next` допускается только безопасный локальный путь и только своего направления. Иначе стартовая
 * страница: у гостиницы `/today` (гейт онбординга стоит там), у салона и ресторана `/register/setup`: он сам ведёт на
 * стартовую страницу направления, когда настройка завершена, и продолжает настройку пилота, если нет.
 */
function targetFor(vertical: WebVertical, rawNext: string | null): string {
  const next = rawNext ? safeReturnPath(rawNext) : null;
  if (next && compatible(next, vertical)) return next;
  return vertical === 'HOSPITALITY' ? landingForVertical(vertical) : '/register/setup';
}

export function decideScope(items: SelectableBranch[], rawNext: string | null): ScopeDecision {
  if (items.length === 0) return { kind: 'empty', target: '/onboarding' };
  if (items.length > 1) return { kind: 'choose', target: '/branches' };
  const only = items[0]!;
  return {
    kind: 'select',
    pointer: `business=${only.location.businessId};location=${only.locationId}`,
    target: targetFor(only.vertical, rawNext),
  };
}

/**
 * Указатель устарел: стойка его пересылает (кука правильной формы), а `/auth/me` не подтвердил ни Business, ни
 * филиал. API на таком указателе отвечает 403 (MV1, fail-closed); стойка это не ослабляет, а сбрасывает выбор через
 * `/scope/resolve`. Кривую куку стойка не пересылает вовсе (`scopeHeader`), сбрасывать её незачем.
 */
export function scopeIsStale(
  cookieValue: string | undefined,
  me: { user: unknown; context?: { businessId?: string | null } | null },
): boolean {
  if (!me.user) return false;
  if (!scopeHeader(cookieValue)['x-wetop-scope']) return false;
  // Подтверждённый выбор всегда несёт Business (scope BUSINESS или LOCATION); без него указатель отклонён
  return !me.context?.businessId;
}
