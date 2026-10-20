// Адаптер назначения в «Персонале»: разбор команды и CAS по версии профиля. HTTP и PostgreSQL проверяет
// tests/integration/beauty-personnel-kind.test.ts.
import { describe, expect, it } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import * as adapter from '../../apps/api/src/beauty/personnel-kind';

const scope = { businessId: 'business-bound', organizationId: 'org-bound' };
const revision = '2026-10-18T12:00:00.123456Z';
const row = { id: 'id', personnelKind: null, profileRevision: revision };
const dbFor = (query: (strings: TemplateStringsArray, ...values: unknown[]) => unknown) =>
  ({ $queryRaw: query }) as unknown as Parameters<typeof adapter.writePersonnelKind>[0];

describe('назначение в «Персонале»: адаптер', () => {
  it('функция включена всегда: флага PERSONNEL_KIND_ENABLED больше нет', () => {
    expect('personnelKindEnabled' in adapter).toBe(false);
  });
  it('строгие значения, лишние ключи и версия в микросекундах', () => {
    for (const kind of ['SPECIALIST', 'OTHER_EMPLOYEE', 'BOTH']) {
      expect(adapter.parsePersonnelKindCommand({ personnelKind: kind, expectedProfileRevision: revision }).personnelKind).toBe(kind);
    }
    for (const body of [
      null, [], {}, { personnelKind: null }, { personnelKind: ['BOTH'] },
      { personnelKind: 'both', expectedProfileRevision: revision },
      { personnelKind: 'BOTH', expectedProfileRevision: revision, name: 'bad' },
      { personnelKind: 'BOTH', expectedProfileRevision: revision.replace('123456', '123') },
      { personnelKind: 'BOTH' },
    ]) expect(() => adapter.parsePersonnelKindCommand(body)).toThrow(BadRequestException);
  });
  it('при создании назначение необязательно, но если пришло, то только одно из трёх', () => {
    expect(adapter.parseCreatePersonnelKind({ name: 'x' })).toBeNull();
    expect(adapter.parseCreatePersonnelKind({ name: 'x', personnelKind: 'OTHER_EMPLOYEE' })).toBe('OTHER_EMPLOYEE');
    for (const value of [null, '', 'ADMIN', 'specialist', 1])
      expect(() => adapter.parseCreatePersonnelKind({ personnelKind: value })).toThrow(BadRequestException);
  });
  it('устаревшая версия под блокировкой не пишет', async () => {
    let calls = 0;
    await expect(adapter.writePersonnelKind(dbFor(() => { calls++; return [{ ...row, profileRevision: revision.replace('456', '457') }]; }), scope, 'id', { personnelKind: 'BOTH', expectedProfileRevision: revision })).rejects.toBeInstanceOf(ConflictException);
    expect(calls).toBe(1);
  });
  it('чужая область: 404 без записи', async () => {
    let calls = 0;
    await expect(adapter.writePersonnelKind(dbFor(() => { calls++; return []; }), scope, 'foreign', { personnelKind: 'BOTH', expectedProfileRevision: revision })).rejects.toBeInstanceOf(NotFoundException);
    expect(calls).toBe(1);
  });
  it('блокировка и запись ограничены организацией и бизнесом, версия растёт хотя бы на микросекунду', async () => {
    const queries: Array<{ sql: string; values: unknown[] }> = [];
    const result = await adapter.writePersonnelKind(dbFor((strings, ...values) => {
      const sql = strings.join('?'); queries.push({ sql, values });
      return [queries.length === 1 ? row : { ...row, personnelKind: 'BOTH', profileRevision: '2026-10-18T12:00:00.123457Z' }];
    }), scope, 'id', { personnelKind: 'BOTH', expectedProfileRevision: revision });
    expect(queries).toHaveLength(2);
    expect(queries[0]!.sql).toContain('FOR UPDATE');
    for (const q of queries) {
      expect(q.sql).toContain('b.organization_id');
      expect(q.values).toEqual(expect.arrayContaining([scope.businessId, scope.organizationId]));
    }
    expect(queries[1]!.sql).toContain("INTERVAL '1 microsecond'");
    expect(queries[1]!.values).toContain(revision);
    expect(result.before.personnelKind).toBeNull();
    expect(result.after.personnelKind).toBe('BOTH');
  });
});
