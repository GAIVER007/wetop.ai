// Adapter unit coverage only: real Nest exceptions, no HTTP/PG acceptance claim.
import { afterEach, describe, expect, it } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import * as adapter from '../../apps/api/src/beauty/personnel-kind';

const scope = { businessId: 'business-bound', organizationId: 'org-bound' };
const revision = '2026-10-18T12:00:00.123456Z';
const row = { id: 'id', name: 'Synthetic', phone: null, email: null, status: 'ACTIVE', profileRevision: revision, personnelKind: null };
const originalFlag = process.env.PERSONNEL_KIND_ENABLED;
afterEach(() => { if (originalFlag === undefined) delete process.env.PERSONNEL_KIND_ENABLED; else process.env.PERSONNEL_KIND_ENABLED = originalFlag; });
const dbFor = (query: (strings: TemplateStringsArray, ...values: unknown[]) => unknown) =>
  ({ $queryRaw: query }) as unknown as Parameters<typeof adapter.writePersonnelKind>[0];

describe('personnel SQL adapter', () => {
  it('OFF never queries and denies writes', async () => {
    delete process.env.PERSONNEL_KIND_ENABLED;
    const db = dbFor(() => { throw Error('unexpected query'); });
    expect(await adapter.readPersonnelEmployeeProfiles(db, scope)).toEqual([]);
    await expect(adapter.writePersonnelKind(db, scope, 'id', { personnelKind: 'BOTH', expectedProfileRevision: revision })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it('strict kinds, unknown keys and microsecond version', () => {
    for (const kind of ['SPECIALIST', 'OTHER_EMPLOYEE', 'BOTH']) {
      expect(adapter.parsePersonnelKindCommand({ personnelKind: kind, expectedProfileRevision: revision }).personnelKind).toBe(kind);
    }
    for (const body of [null, [], {}, { personnelKind: null }, { personnelKind: ['BOTH'] }, { personnelKind: 'both', expectedProfileRevision: revision }, { personnelKind: 'BOTH', expectedProfileRevision: revision, name: 'bad' }, { personnelKind: 'BOTH', expectedProfileRevision: revision.replace('123456', '123') }]) expect(() => adapter.parsePersonnelKindCommand(body)).toThrow(BadRequestException);
  });
  it('ON projects the full row and source in one bound scoped read', async () => {
    process.env.PERSONNEL_KIND_ENABLED = '1'; let calls = 0;
    const db = dbFor((strings, ...values) => {
      calls++; const sql = strings.join('?');
      for (const column of ['e.id', 'e.name', 'e.phone', 'e.email', 'e.status', 'e.personnel_kind', 'e.updated_at', 'SS.US']) expect(sql).toContain(column);
      expect(sql).toContain('b.organization_id'); expect(sql).toContain('e.business_id');
      expect(sql).not.toMatch(/FOR UPDATE|UPDATE employees/);
      expect(values).toEqual([scope.businessId, scope.organizationId]);
      expect(sql).not.toContain(scope.businessId); expect(sql).not.toContain(scope.organizationId);
      return [row];
    });
    expect(await adapter.readPersonnelEmployeeProfiles(db, scope)).toEqual([row]); expect(calls).toBe(1);
  });
  it('ON missing held column fails even when no employees exist', async () => {
    process.env.PERSONNEL_KIND_ENABLED = '1'; let calls = 0;
    await expect(adapter.readPersonnelEmployeeProfiles(dbFor(() => { calls++; throw Error('missing column'); }), scope)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(calls).toBe(1);
  });
  it('ON empty successful read still queries held column', async () => {
    process.env.PERSONNEL_KIND_ENABLED = '1'; let calls = 0;
    expect(await adapter.readPersonnelEmployeeProfiles(dbFor((strings) => { calls++; expect(strings.join('?')).toContain('personnel_kind'); return []; }), scope)).toEqual([]);
    expect(calls).toBe(1);
  });
  it('rejects invalid stored enum rather than inferring or coercing', async () => {
    process.env.PERSONNEL_KIND_ENABLED = '1';
    await expect(adapter.readPersonnelEmployeeProfiles(dbFor(() => [{ ...row, personnelKind: 'unknown' }]), scope)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it('stale locked source never updates', async () => {
    process.env.PERSONNEL_KIND_ENABLED = '1'; let calls = 0;
    await expect(adapter.writePersonnelKind(dbFor(() => { calls++; return [{ ...row, profileRevision: revision.replace('456', '457') }]; }), scope, 'id', { personnelKind: 'BOTH', expectedProfileRevision: revision })).rejects.toBeInstanceOf(ConflictException);
    expect(calls).toBe(1);
  });
  it('foreign scoped lock never updates', async () => {
    process.env.PERSONNEL_KIND_ENABLED = '1'; let calls = 0;
    await expect(adapter.writePersonnelKind(dbFor(() => { calls++; return []; }), scope, 'foreign', { personnelKind: 'BOTH', expectedProfileRevision: revision })).rejects.toBeInstanceOf(NotFoundException);
    expect(calls).toBe(1);
  });
  it('CAS binds the original microsecond source and advances at least a microsecond', async () => {
    process.env.PERSONNEL_KIND_ENABLED = '1'; const queries: string[] = [];
    await adapter.writePersonnelKind(dbFor((strings, ...values) => {
      const sql = strings.join('?'); queries.push(sql);
      if (queries.length === 2) { expect(sql).toContain("INTERVAL '1 microsecond'"); expect(sql).toContain('SS.US'); expect(values).toContain(revision); }
      return [row];
    }), scope, 'id', { personnelKind: 'BOTH', expectedProfileRevision: revision });
    expect(queries).toHaveLength(2); expect(queries[0]).toContain('FOR UPDATE'); expect(queries[1]).toContain('UPDATE employees');
  });
});
