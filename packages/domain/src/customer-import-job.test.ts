import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  CUSTOMER_IMPORT_CHUNK_MAX_ROWS,
  CUSTOMER_IMPORT_ENVELOPE_MAX_BYTES,
  CUSTOMER_IMPORT_MAX_ROWS,
  CustomerImportError,
  canUndoCustomerImport,
  customerImportRowInput,
  parseCustomerImportChunk,
  parseCustomerImportStart,
  type CustomerImportOutcome,
  type CustomerImportState,
  type CustomerImportView,
} from './customer-import-job';

function expectSafeError(call: () => unknown, code: CustomerImportError['code'] = 'INVALID_ENVELOPE') {
  try {
    call();
    throw new Error('expected CustomerImportError');
  } catch (error) {
    expect(error).toBeInstanceOf(CustomerImportError);
    expect((error as CustomerImportError).code).toBe(code);
    expect((error as Error).message).toBe(code);
  }
}

describe('M4-B2: durable customer import domain contract', () => {
  it('parses an idempotent start request and rejects unsafe bounds', () => {
    expect(parseCustomerImportStart({
      clientRequestId: '9f109685-3f51-47a2-95fd-2d6e655b0e7e',
      totalRows: CUSTOMER_IMPORT_MAX_ROWS,
      organizationId: 'forged',
    })).toEqual({ clientRequestId: '9f109685-3f51-47a2-95fd-2d6e655b0e7e', totalRows: 50_000 });

    for (const raw of [
      null,
      { clientRequestId: 'not-a-uuid', totalRows: 1 },
      { clientRequestId: '9f109685-3f51-47a2-95fd-2d6e655b0e7e', totalRows: 0 },
      { clientRequestId: '9f109685-3f51-47a2-95fd-2d6e655b0e7e', totalRows: 50_001 },
      { clientRequestId: '9f109685-3f51-47a2-95fd-2d6e655b0e7e', totalRows: 1.5 },
    ]) expectSafeError(() => parseCustomerImportStart(raw));
  });

  it('accepts a bounded sequential chunk and keeps only mapped row fields', () => {
    expect(parseCustomerImportChunk({
      offset: 0,
      rows: [{ sourceLine: 2, firstName: ' Тест ', lastName: null, phone: '87000001001', customerId: 'forged' }],
      businessId: 'forged',
    })).toEqual({
      offset: 0,
      rows: [{ sourceLine: 2, firstName: ' Тест ', lastName: null, phone: '87000001001' }],
    });
  });

  it('rejects malformed chunk structure without echoing personal content', () => {
    const secret = 'Не повторять это значение';
    const invalid = [
      null,
      { offset: -1, rows: [] },
      { offset: 1.5, rows: [] },
      { offset: 0, rows: 'bad' },
      { offset: 0, rows: [] },
      { offset: 0, rows: [{ sourceLine: 1, firstName: secret, lastName: null, phone: null }] },
      { offset: 0, rows: [{ sourceLine: 2.5, firstName: secret, lastName: null, phone: null }] },
      { offset: 0, rows: Array.from({ length: CUSTOMER_IMPORT_CHUNK_MAX_ROWS + 1 }, (_, i) => ({ sourceLine: i + 2 })) },
    ];
    for (const raw of invalid) {
      try {
        parseCustomerImportChunk(raw);
        throw new Error('expected CustomerImportError');
      } catch (error) {
        expect(error).toBeInstanceOf(CustomerImportError);
        expect((error as Error).message).not.toContain(secret);
      }
    }
  });

  it('keeps offsets, batch ranges and source lines inside database integer bounds', () => {
    const row = { sourceLine: 2, firstName: 'Тест', lastName: null, phone: null };
    for (const raw of [
      { offset: 10 ** 20, rows: [row] },
      { offset: CUSTOMER_IMPORT_MAX_ROWS, rows: [row] },
      { offset: CUSTOMER_IMPORT_MAX_ROWS - 1, rows: [row, { ...row, sourceLine: 3 }] },
      { offset: 0, rows: [{ ...row, sourceLine: 10 ** 20 }] },
      { offset: 0, rows: [{ ...row, sourceLine: 2_147_483_648 }] },
    ]) expectSafeError(() => parseCustomerImportChunk(raw));

    expect(parseCustomerImportChunk({
      offset: CUSTOMER_IMPORT_MAX_ROWS - 1,
      rows: [{ ...row, sourceLine: 2_147_483_647 }],
    })).toEqual({
      offset: 49_999,
      rows: [{ ...row, sourceLine: 2_147_483_647 }],
    });
  });

  it('measures the complete serialized UTF-8 envelope and fails safely when it cannot serialize', () => {
    const oversized = { offset: 0, rows: [{ sourceLine: 2, firstName: 'я'.repeat(CUSTOMER_IMPORT_ENVELOPE_MAX_BYTES), lastName: null, phone: null }] };
    expectSafeError(() => parseCustomerImportChunk(oversized), 'PAYLOAD_TOO_LARGE');

    const circular: Record<string, unknown> = { offset: 0, rows: [] };
    circular['self'] = circular;
    expectSafeError(() => parseCustomerImportChunk(circular));
  });

  it('normalizes valid row fields without accepting forged identifiers', () => {
    expect(customerImportRowInput({
      sourceLine: 2,
      firstName: '  Айдана  ',
      lastName: '  Тестова ',
      phone: ' 8 (700) 000-10-01 ',
      customerId: 'forged',
    } as never)).toEqual({
      ok: true,
      value: { firstName: 'Айдана', lastName: 'Тестова', phone: '8 (700) 000-10-01' },
    });
  });

  it('uses the approved default name only for a valid phone without a name', () => {
    expect(customerImportRowInput({ sourceLine: 2, firstName: '', lastName: null, phone: '+77000001001' }))
      .toEqual({ ok: true, value: { firstName: 'Клиент', lastName: null, phone: '+77000001001' } });
    expect(customerImportRowInput({ sourceLine: 2, firstName: '', lastName: 'Тестова', phone: null }))
      .toEqual({ ok: false, code: 'MISSING_NAME_AND_PHONE' });
  });

  it('allows a named customer without phone and classifies row errors with safe codes', () => {
    expect(customerImportRowInput({ sourceLine: 2, firstName: 'Без номера', lastName: '', phone: '' }))
      .toEqual({ ok: true, value: { firstName: 'Без номера', lastName: null, phone: null } });

    expect(customerImportRowInput({ sourceLine: 2, firstName: 17, lastName: null, phone: null }))
      .toEqual({ ok: false, code: 'INVALID_FIRST_NAME' });
    expect(customerImportRowInput({ sourceLine: 2, firstName: 'а'.repeat(101), lastName: null, phone: null }))
      .toEqual({ ok: false, code: 'INVALID_FIRST_NAME' });
    expect(customerImportRowInput({ sourceLine: 2, firstName: 'Тест', lastName: {}, phone: null }))
      .toEqual({ ok: false, code: 'INVALID_LAST_NAME' });
    expect(customerImportRowInput({ sourceLine: 2, firstName: 'Тест', lastName: 'а'.repeat(101), phone: null }))
      .toEqual({ ok: false, code: 'INVALID_LAST_NAME' });
    expect(customerImportRowInput({ sourceLine: 2, firstName: 'Тест', lastName: null, phone: 'номер' }))
      .toEqual({ ok: false, code: 'INVALID_PHONE' });
    expect(customerImportRowInput({ sourceLine: 2, firstName: 'Тест', lastName: null, phone: '7'.repeat(33) }))
      .toEqual({ ok: false, code: 'INVALID_PHONE' });
  });

  it('keeps the undo boundary strict and UTC-instant based', () => {
    const deadline = new Date('2026-10-19T12:00:00.000Z');
    expect(canUndoCustomerImport(deadline, new Date('2026-10-19T11:59:59.999Z'))).toBe(true);
    expect(canUndoCustomerImport(deadline, new Date('2026-10-19T12:00:00.000Z'))).toBe(false);
    expect(canUndoCustomerImport(deadline, new Date('2026-10-19T12:00:00.001Z'))).toBe(false);
    expect(canUndoCustomerImport(null, new Date('2026-10-19T11:59:59.999Z'))).toBe(false);
    expect(canUndoCustomerImport(new Date('invalid'), new Date('2026-10-19T11:59:59.999Z'))).toBe(false);
    expect(canUndoCustomerImport(deadline, new Date('invalid'))).toBe(false);
  });

  it('exports the approved states, outcomes and exact public view shape', () => {
    expectTypeOf<CustomerImportState>().toEqualTypeOf<'UPLOADING' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'UNDOING' | 'UNDONE'>();
    expectTypeOf<CustomerImportOutcome>().toEqualTypeOf<'PENDING' | 'CREATED' | 'LINKED' | 'UNCHANGED' | 'SKIPPED'>();
    expectTypeOf<CustomerImportView>().toEqualTypeOf<{
      id: string; state: CustomerImportState; totalRows: number; uploadedRows: number; processedRows: number;
      createdCount: number; linkedCount: number; unchangedCount: number; skippedCount: number;
      errorCode: string | null; createdAt: string; completedAt: string | null; undoDeadline: string | null;
      contentsExpired: boolean;
    }>();
  });
});
