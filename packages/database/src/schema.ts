/**
 * Схема базы для процесса (ADR-042): рабочие данные — `public`, автотесты — `pms_test` того же проекта Supabase.
 * Переменная `DATABASE_SCHEMA`; имя попадает в SQL, который строит Prisma, поэтому допускается только простой идентификатор.
 */
const IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/;

/** Имя схемы из переменной; undefined — схема по умолчанию (public). Недопустимое имя — ошибка, а не тихая подстановка. */
export function resolveDatabaseSchema(value: string | undefined): string | undefined {
  const v = value?.trim();
  if (!v || v === 'public') return undefined;
  if (!IDENTIFIER.test(v))
    throw new Error(`DATABASE_SCHEMA «${v}»: допустимы только строчные латинские буквы, цифры и _`);
  return v;
}

/** Для диагностики: в какой схеме работает процесс */
export function databaseSchemaName(env: Record<string, string | undefined> = process.env): string {
  return resolveDatabaseSchema(env['DATABASE_SCHEMA']) ?? 'public';
}
