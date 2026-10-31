import { safeReturnPath } from './auth-entry';
import { scopeHeader } from './scope-pointer';
import { routeVertical, type WebVertical } from './vertical-landing';

/**
 * Выбор рабочего филиала после входа и после устаревшего указателя (SCOPE-HARDENING, решение владельца 06.10.2026).
 * Источник один: ответ сервера `GET /branches` от имени текущей сессии. Значения Business и филиала из адреса, тела
 * запроса или прежней куки не берутся.
 *
 * - филиалов нет: прежний путь настройки (`/onboarding`);
 * - филиал один: выбирается сам;
 * - филиалов несколько: открывается тот, что человек сам выбирал последним на этом устройстве, если он есть в ответе
 *   сервера (13.10.2026); иначе человек выбирает сам на `/branches`. «Первый попавшийся» не выбирается никогда.
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

/** Разделы, общие для всех направлений: их меню есть и у салона, и у ресторана; `/today` с MV8 */
const SHARED = ['/today', '/journal', '/help', '/learn', '/profile', '/staff', '/team'];

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
 * страница: у гостиницы единые «Финансы» (гейт онбординга в layout работает и там), у салона и ресторана
 * `/register/setup`: он сам ведёт на стартовую страницу направления, когда настройка завершена, и продолжает
 * настройку пилота, если нет.
 *
 * Переход «/today» гостиницы на «Финансы» не сокращать (13.10.2026): подтверждение почты зовёт серверное действие,
 * его `redirect` ведёт на `/scope/resolve?next=%2Ftoday`, и если цепочка кончается обработчиком маршрута, клиентский
 * роутер Next оставляет в адресной строке адрес действия (показывает «Финансы» под адресом `/scope/resolve…`). Через
 * страницу `/today` адрес обновляется верно (`login-access`, `unified-auth`).
 */
function targetFor(vertical: WebVertical, rawNext: string | null): string {
  const next = rawNext ? safeReturnPath(rawNext) : null;
  if (vertical === 'BEAUTY' && (!next || next === '/today' || !compatible(next, vertical)))
    return '/register/setup?entry=1';
  // без своего адреса (или общий «/today»): корень `/`, он выбирает стартовый экран по роли (владелец 27.10.2026)
  if (vertical === 'HOSPITALITY' && (!next || next === '/today')) return '/';
  // ресторан без адреса по-прежнему идёт через настройку, она сама отправит на `/`, когда настройка завершена
  if (vertical === 'FOOD_SERVICE' && next === '/today') return '/';
  if (next && compatible(next, vertical)) return next;
  return vertical === 'HOSPITALITY' ? '/' : '/register/setup';
}

export function decideScope(
  items: SelectableBranch[],
  rawNext: string | null,
  rememberedLocationId: string | null = null,
  options: { personal?: boolean } = {},
): ScopeDecision {
  if (items.length === 0) return { kind: 'empty', target: '/onboarding' };
  const remembered = rememberedLocationId
    ? items.find((item) => item.locationId === rememberedLocationId)
    : undefined;
  // «Личный кабинет» (EMPLOYEE): экрана выбора на /branches у него нет, поэтому без запомненного берётся первый из его
  // назначений (список уже сужен сервером), а вход ведёт в «Мою работу» (живой аудит 21.10.2026)
  const chosen = items.length === 1 ? items[0]! : (remembered ?? (options.personal ? items[0] : undefined));
  if (!chosen) return { kind: 'choose', target: '/branches' };
  const next = rawNext ? safeReturnPath(rawNext) : null;
  return {
    kind: 'select',
    pointer: `business=${chosen.location.businessId};location=${chosen.locationId}`,
    target: options.personal
      ? next && (next === '/my-work' || next.startsWith('/my-work?') || next.startsWith('/my-work/'))
        ? next
        : '/my-work'
      : targetFor(chosen.vertical, rawNext),
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
