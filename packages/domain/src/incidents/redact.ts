/**
 * Маскирование того, что уходит в неисправность и в сообщение (DATA_MODEL §12). Два правила:
 * поле, по имени похожее на персональные данные гостя или карту, скрывается целиком; в тексте маскируются
 * секреты — JWT, Bearer, пароль в строке подключения, длинные ключи. UUID и номера броней остаются: без них
 * неисправность не разобрать.
 */

const MAX_TEXT = 500;
const MAX_DEPTH = 4;
const MAX_ITEMS = 20;
const HIDDEN = '[скрыто]';

const PII_KEY =
  /name|surname|phone|e-?mail|mail|passport|document|birth|address|card|guarantee|cvv|customer|guest|token|secret|password|api[-_]?key/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function redactText(text: string): string {
  const masked = text
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[jwt]')
    .replace(/\b(Bearer|Basic)\s+\S+/gi, '$1 [скрыто]')
    .replace(/(\w+:\/\/[^\s:/@]+:)[^\s@/]+@/g, '$1***@')
    .replace(/[A-Za-z0-9_-]{32,}/g, (m) => (UUID.test(m) ? m : `${m.slice(0, 4)}…`));
  return masked.length > MAX_TEXT ? `${masked.slice(0, MAX_TEXT)}…` : masked;
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
