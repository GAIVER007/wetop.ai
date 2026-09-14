/**
 * Схема pms_test для автотестов (ADR-042) — чистые правила: какие миграции накатить, в каком порядке копировать таблицы,
 * как привести перечисления, какой спек не пускать в изолированный прогон. Работа с базой — test-schema.ts.
 */

/** Схема автотестов в том же проекте Supabase «hotel»; рабочие данные — public, их тесты не трогают */
export const TEST_SCHEMA = 'pms_test';
/** Порты стенда e2e: рабочие 3000/3001 держит launchd и в тестах не используются */
export const TEST_WEB_PORT = 3100;
export const TEST_API_PORT = 3101;

export function pendingMigrations(all: readonly string[], applied: ReadonlySet<string>): string[] {
  return [...all].sort().filter((m) => !applied.has(m));
}

/** Порядок копирования: таблица после всех, на которые ссылается; ссылка на себя не учитывается; цикл — ошибка. */
export function copyOrder(
  tables: readonly string[],
  foreignKeys: ReadonlyArray<{ table: string; references: string }>,
): string[] {
  const known = new Set(tables);
  const deps = new Map(tables.map((t) => [t, new Set<string>()]));
  for (const fk of foreignKeys)
    if (fk.table !== fk.references && known.has(fk.table) && known.has(fk.references))
      deps.get(fk.table)!.add(fk.references);
  const sorted = [...tables].sort();
  const done = new Set<string>();
  const order: string[] = [];
  while (order.length < sorted.length) {
    const next = sorted.find((t) => !done.has(t) && [...deps.get(t)!].every((d) => done.has(d)));
    if (!next)
      throw new Error(`цикл внешних ключей: ${sorted.filter((t) => !done.has(t)).join(', ')}`);
    order.push(next);
    done.add(next);
  }
  return order;
}

export interface ColumnInfo {
  name: string;
  /** information_schema.columns.data_type */
  dataType: string;
  udtSchema: string;
  udtName: string;
  generated: boolean;
}

const ident = (s: string) => `"${s.replace(/"/g, '""')}"`;

/**
 * Колонки INSERT … SELECT из public в тестовую схему. Перечисления в тестовой схеме — свои типы, неявно из public
 * не приводятся, поэтому идут через text; вычисляемые колонки база заполнит сама.
 */
export function selectExpressions(
  columns: readonly ColumnInfo[],
  schema: string,
): { insertColumns: string[]; selectList: string[] } {
  const insertColumns: string[] = [];
  const selectList: string[] = [];
  for (const c of columns) {
    if (c.generated) continue;
    insertColumns.push(ident(c.name));
    if (c.dataType === 'USER-DEFINED' && c.udtSchema === schema)
      selectList.push(`${ident(c.name)}::text::${ident(schema)}.${ident(c.udtName)}`);
    else if (c.dataType === 'ARRAY' && c.udtSchema === schema && c.udtName.startsWith('_'))
      selectList.push(`${ident(c.name)}::text[]::${ident(schema)}.${ident(c.udtName.slice(1))}[]`);
    else selectList.push(ident(c.name));
  }
  return { insertColumns, selectList };
}

/**
 * Строка спека с жёстким адресом рабочего стенда (3000/3001). Запасное значение после `??` не в счёт:
 * прогон задаёт APP_API_URL, и спек пойдёт на тестовый стенд.
 */
export function hardcodedLiveAddress(line: string): boolean {
  return /(127\.0\.0\.1|localhost):300[01]\b/.test(line) && !line.includes('??');
}
