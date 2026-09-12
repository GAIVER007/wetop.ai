/**
 * Гражданство гостя — код страны ISO 3166-1 alpha-3 (DATA_MODEL §3), обязательно к заселению (eQonaq).
 *
 * В базе колонка объявлена как CHAR(3): Postgres дополняет короткие значения пробелами, и пустая строка,
 * записанная импортом из Exely, возвращается как '   '. Такая строка истинна в JS, поэтому проверка
 * `if (!guest.citizenship)` её пропускала, а карточка печатала «гражданство    ». Любое «есть/нет»
 * по гражданству обязано идти через эти функции; при записи гражданство тоже нормализуется.
 */
export function normalizeCitizenship(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim().toUpperCase();
  return value === '' ? null : value;
}

/** Правило заселения: гражданство указано (не null, не пустое, не одни пробелы). */
export function hasCitizenship(raw: string | null | undefined): boolean {
  return normalizeCitizenship(raw) !== null;
}
