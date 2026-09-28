/**
 * Указатель выбора Business и филиала (Platform P2, К1; план P2 §4б, ADR-120). Кука стойки `wetop_scope` — намерение
 * человека, а не право: стойка пересылает её API заголовком `X-Wetop-Scope` как есть, а API проверяет его на каждом
 * запросе. Ставит куку переключатель Platform P3; пока его нет, куки нет и заголовка тоже.
 */
export const SCOPE_COOKIE = 'wetop_scope';

/** Длиннее двух UUID с ключами указатель не бывает — длинное значение не пересылаем */
const MAX_POINTER_LENGTH = 200;

export function scopeHeader(cookieValue: string | undefined): Record<string, string> {
  if (!cookieValue || cookieValue.length > MAX_POINTER_LENGTH) return {};
  let value: string;
  try {
    value = decodeURIComponent(cookieValue);
  } catch {
    return {};
  }
  return value.trim() ? { 'x-wetop-scope': value.trim() } : {};
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
