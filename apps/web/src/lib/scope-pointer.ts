import { cookieSecure } from './session-cookie';

/**
 * Указатель выбора Business и филиала (Platform P2, К1; план P2 §4б, ADR-120). Кука стойки `wetop_scope` — намерение
 * человека, а не право: стойка пересылает её API заголовком `X-Wetop-Scope` как есть, а API проверяет его на каждом
 * запросе. Ставят куку только переключатель филиала, завершение регистрации и `/scope/resolve` (SCOPE-HARDENING);
 * значение всегда из ответа сервера, не из адреса или тела запроса.
 */
export const SCOPE_COOKIE = 'wetop_scope';

/** Признаки куки указателя: те же, что у сессии (`Secure` только по https, правило `cookieSecure`). */
export function scopeCookieOptions(env: Record<string, string | undefined>) {
  return { httpOnly: true, sameSite: 'lax' as const, secure: cookieSecure(env), path: '/' };
}

/**
 * Подсказка «последний выбранный филиал» на этом устройстве (13.10.2026: владелец с четырьмя филиалами после каждого
 * входа оставался без выбора, шапка писала «Филиал недоступен» и урезала меню). Это не право и не указатель:
 * `/scope/resolve` выбирает филиал по подсказке, только если он есть в ответе сервера `GET /branches` для текущей
 * сессии. Поэтому выход её не стирает, а чужой человек на этом устройстве по ней не откроет ничего чужого.
 */
export const LAST_BRANCH_COOKIE = 'wetop_last_branch';

/** Полгода: выбор переживает выход и истечение сессии */
const LAST_BRANCH_MAX_AGE = 60 * 60 * 24 * 180;

export function lastBranchCookieOptions(env: Record<string, string | undefined>) {
  return { ...scopeCookieOptions(env), maxAge: LAST_BRANCH_MAX_AGE };
}

/** `Set-Cookie` подсказки «последний филиал» для обработчиков, которые собирают ответ сами (переход в организацию) */
export function lastBranchCookieHeader(locationId: string, env: Record<string, string | undefined>): string {
  const parts = [`${LAST_BRANCH_COOKIE}=${locationId}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${LAST_BRANCH_MAX_AGE}`];
  if (cookieSecure(env)) parts.push('Secure');
  return parts.join('; ');
}

/** `Set-Cookie`, снимающий указатель, для обработчиков, которые собирают ответ сами (вход с сайта, резервная форма). */
export function clearScopeCookieHeader(env: Record<string, string | undefined>): string {
  const parts = [`${SCOPE_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (cookieSecure(env)) parts.push('Secure');
  return parts.join('; ');
}

/** Куда вести после входа и после устаревшего указателя: выбор филиала решает сервер (`app/scope/resolve`). */
export function scopeResolvePath(next: string): string {
  return `/scope/resolve?next=${encodeURIComponent(next)}`;
}

/** Длиннее двух UUID с ключами указатель не бывает — длинное значение не пересылаем */
const MAX_POINTER_LENGTH = 200;

/**
 * Единственный вид указателя, который пересылаем: `business=<uuid>` или `business=<uuid>;location=<uuid>`. Кука —
 * чужой ввод: значение с переводом строки или не-Latin-1 символом fetch не принимает в заголовок и бросает
 * `TypeError`, и каждый запрос стойки отвечал «Нет связи с API», пока куку не удалят. Разбор и проверку прав делает
 * API (`auth/scope.ts`), здесь только форма.
 */
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const POINTER = new RegExp(`^business=${UUID}(;location=${UUID})?$`, 'i');

/** Филиал из правильного указателя (`business=…;location=…`); иначе `null` */
export function pointerLocation(pointer: string): string | null {
  return POINTER.test(pointer) ? (/;location=([0-9a-f-]+)$/i.exec(pointer)?.[1] ?? null) : null;
}

/** Значение подсказки, если это UUID; кука чужой ввод, всё прочее отбрасывается */
export function lastBranchValue(cookieValue: string | undefined): string | null {
  return cookieValue && new RegExp(`^${UUID}$`, 'i').test(cookieValue) ? cookieValue : null;
}

export function scopeHeader(cookieValue: string | undefined): Record<string, string> {
  if (!cookieValue || cookieValue.length > MAX_POINTER_LENGTH) return {};
  let value: string;
  try {
    value = decodeURIComponent(cookieValue).trim();
  } catch {
    return {};
  }
  return POINTER.test(value) ? { 'x-wetop-scope': value } : {};
}

/** Заголовок из куки текущего запроса стойки. Вне серверного запроса (сборка, клиент) — пусто, без исключения. */
export async function requestScopeHeader(): Promise<Record<string, string>> {
  try {
    const { cookies } = await import('next/headers');
    return scopeHeader((await cookies()).get(SCOPE_COOKIE)?.value);
  } catch {
    return {};
  }
}
