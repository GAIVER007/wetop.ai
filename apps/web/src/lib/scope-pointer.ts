/**
 * Указатель выбора Business и филиала (Platform P2, К1; план P2 §4б, ADR-120). Кука стойки `wetop_scope` — намерение
 * человека, а не право: стойка пересылает её API заголовком `X-Wetop-Scope` как есть, а API проверяет его на каждом
 * запросе. Ставит куку переключатель Platform P3; пока его нет, куки нет и заголовка тоже.
 */
export const SCOPE_COOKIE = 'wetop_scope';

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
