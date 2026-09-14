import { describe, expect, it } from 'vitest';
import { databaseSchemaName, resolveDatabaseSchema } from './schema';

/**
 * Автотесты работают в схеме pms_test того же проекта Supabase, рабочие данные — в public (ADR-040).
 * Имя схемы попадает в SQL, который строит Prisma, поэтому принимается только простой идентификатор.
 */
describe('resolveDatabaseSchema', () => {
  it('без переменной или public — схема по умолчанию (рабочие данные)', () => {
    expect(resolveDatabaseSchema(undefined)).toBeUndefined();
    expect(resolveDatabaseSchema('')).toBeUndefined();
    expect(resolveDatabaseSchema('  public ')).toBeUndefined();
  });
  it('тестовая схема проходит как есть', () => {
    expect(resolveDatabaseSchema('pms_test')).toBe('pms_test');
  });
  it('кавычки, точки, пробелы, заглавные — отказ, а не тихая подстановка', () => {
    for (const bad of ['pms-test', 'pms_test;drop', '"pms_test"', 'a.b', 'PMS_TEST', '1abc'])
      expect(() => resolveDatabaseSchema(bad)).toThrow(/DATABASE_SCHEMA/);
  });
  it('databaseSchemaName — для диагностики: public, если схема не задана', () => {
    expect(databaseSchemaName({})).toBe('public');
    expect(databaseSchemaName({ DATABASE_SCHEMA: 'pms_test' })).toBe('pms_test');
  });
});
