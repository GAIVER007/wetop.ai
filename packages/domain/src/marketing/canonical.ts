import { createHash } from 'node:crypto';

/**
 * Каноническая запись JSON для хэша версии сайта (MKT3, `DATA_MODEL.md` §29.3): ключи объектов по возрастанию кодовых
 * единиц UTF-16 (как RFC 8785), массивы в своём порядке, без пробелов, строки и числа как в `JSON.stringify`. Один и тот
 * же документ даёт одну и ту же строку при любом порядке ключей; `undefined` в объекте пропускается, как в JSON.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string')
    return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('canonicalJson: число вне JSON');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item ?? null)).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  throw new TypeError(`canonicalJson: ${typeof value} вне JSON`);
}

/** sha256 канонической записи в UTF-8: 64 символа нижнего регистра (`marketing_site_versions.spec_hash`) */
export function siteSpecHash(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

/** Размер документа в байтах канонической записи: по нему считается предел 256 КБ */
export function canonicalByteLength(value: unknown): number {
  return Buffer.byteLength(canonicalJson(value), 'utf8');
}
