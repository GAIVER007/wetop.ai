import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import type { PrismaService } from '../database/prisma.provider';
import { AuditService } from './audit.module';

/**
 * Журнал действий (волна 3, plans/wetop-domain-2026-09-14.md §7.3). Поиск шёл в браузере по последним 200 строкам, а
 * синхронизация Exely пишет `exely.sync` каждые 5 минут — это ~17 часов, и вкладка «История» брони была пустой.
 *
 * Волна 4: список не тянет снимки брони. Из них берут одну короткую строку («номер брони»), а на массовой
 * правке цен и на импорте снимок весит мегабайты — 200 строк уезжали целиком через пулер в Сингапур.
 */
interface SqlLike {
  strings: readonly string[];
  values: readonly unknown[];
}
const isSql = (v: unknown): v is SqlLike =>
  typeof v === 'object' && v !== null && Array.isArray((v as SqlLike).strings);

/** Разворачивает вложенные `Prisma.sql` в один текст и плоский список значений — как это делает Prisma. */
function flatten(strings: readonly string[], values: readonly unknown[]) {
  let sql = strings[0] ?? '';
  const flat: unknown[] = [];
  values.forEach((value, i) => {
    if (isSql(value)) {
      const inner = flatten(value.strings, value.values);
      sql += inner.sql;
      flat.push(...inner.values);
    } else {
      sql += '?';
      flat.push(value);
    }
    sql += strings[i + 1] ?? '';
  });
  return { sql, values: flat };
}

function fakePrisma() {
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  const prisma = {
    db: {
      async $queryRaw(strings: readonly string[], ...values: unknown[]) {
        queries.push(flatten(strings, values));
        return [];
      },
    },
  } as unknown as PrismaService;
  return { service: new AuditService(prisma), queries };
}

describe('AuditService.list', () => {
  it('ищет номер брони или код ячейки в базе по всей истории, а не в последних 200 строках', async () => {
    const { service, queries } = fakePrisma();
    await service.list({ limit: 200, q: '20260914-513903-1263744450' });
    const { sql, values } = queries[0]!;
    for (const key of ['confirmationNumber', 'code', 'uniqueId']) expect(sql).toContain(key);
    expect(values).toContain('%20260914-513903-1263744450%');
  });

  it('служебные строки синхронизации Exely по умолчанию скрыты, по запросу — показаны', async () => {
    const { service, queries } = fakePrisma();
    await service.list({ limit: 200 });
    expect(JSON.stringify(queries[0]!.values)).toContain('exely.sync');
    await service.list({ limit: 200, system: true });
    expect(JSON.stringify(queries[1]!.values)).not.toContain('exely.sync');
  });

  it('снимки брони наружу не едут: в выборке только короткие поля и сводка', async () => {
    const { service, queries } = fakePrisma();
    await service.list({ limit: 200 });
    const select = queries[0]!.sql.slice(0, queries[0]!.sql.indexOf('FROM'));
    // Выбираются короткие поля и сводка: снимки участвуют только внутри неё, отдельными колонками — нет
    expect(select).toContain('SELECT "id", "created_at", "entity_type", "entity_id", "action", COALESCE(');
    expect(select).toContain('AS "subject"');
    expect(select.replace(/COALESCE\([^]*\)\s*AS "subject"/, '')).not.toMatch(/"(before|after)"/);
  });
});
