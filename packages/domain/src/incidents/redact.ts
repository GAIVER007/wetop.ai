/**
 * Маскирование того, что уходит в неисправность и в сообщение (DATA_MODEL §12). Два правила:
 * поле, по имени похожее на персональные данные гостя или карту, скрывается целиком; в тексте маскируются
 * секреты — JWT, Bearer, пароль в строке подключения, длинные ключи. UUID и номера броней остаются: без них
 * неисправность не разобрать.
 */

import { maskContacts } from '@pms/shared';

const MAX_TEXT = 500;
const MAX_DEPTH = 4;
const MAX_ITEMS = 20;
const HIDDEN = '[скрыто]';

const PII_KEY =
  /name|surname|phone|e-?mail|mail|passport|document|birth|address|card|guarantee|cvv|customer|guest|token|secret|password|api[-_]?key/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Текст ошибки, неисправности или сообщения без секретов и без контактов гостя. Пароль в строке подключения
 * снимается раньше почты — иначе `user:пароль@хост` целиком ушёл бы в `<почта>`, и хост было бы не узнать.
 * `max` — длина: 500 для неисправностей, для `last_error` (колонка на экране событий) — своя.
 */
export function redactText(text: string, max = MAX_TEXT): string {
  // Маскируем не больше, чем может попасть в ответ, с запасом на то, что маска укорачивает: раньше маска шла по всему
  // тексту — эхо ввода в 100 КБ стоило секунд остановленного API (аудит 26.09, С-38). Недописанное последнее слово
  // отбрасывается, чтобы на границе не осталось почты или ключа без маски.
  const limit = Math.max(max * 4, 2_000);
  let head = text.length > limit ? text.slice(0, limit) : text;
  if (head.length < text.length) {
    const tail = head.search(/\S*$/);
    // короткий хвост — разрезанная почта или ключ; длинное слово целиком не теряем, его снимет правило длинных ключей
    if (head.length - tail < 200) head = head.slice(0, tail);
  }
  // Выражения начинаются на границе слова: без якоря каждое перебирало все позиции длинного слова
  const masked = maskContacts(
    head
      .replace(/(?<![\w-])eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[jwt]')
      .replace(/\b(Bearer|Basic)\s+\S+/gi, '$1 [скрыто]')
      .replace(/(?<!\w)(\w+:\/\/[^\s:/@]+:)[^\s@/]+@/g, '$1***@')
      .replace(/[A-Za-z0-9_-]{32,}/g, (m) => (UUID.test(m) ? m : `${m.slice(0, 4)}…`)),
  );
  return masked.length > max || head.length < text.length ? `${masked.slice(0, max)}…` : masked;
}

export function redactDetails(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (depth >= MAX_DEPTH) return '[…]';
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ITEMS).map((v) => redactDetails(v, depth + 1));
    return value.length > MAX_ITEMS ? [...items, `… ещё ${value.length - MAX_ITEMS}`] : items;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, MAX_ITEMS))
      out[k] = PII_KEY.test(k) ? HIDDEN : redactDetails(v, depth + 1);
    return out;
  }
  return String(value);
}
