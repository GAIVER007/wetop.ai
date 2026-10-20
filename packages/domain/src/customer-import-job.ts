import { customerPhoneKey } from './customers';

export const CUSTOMER_IMPORT_MAX_ROWS = 50_000;
export const CUSTOMER_IMPORT_CHUNK_MAX_ROWS = 1_000;
export const CUSTOMER_IMPORT_ENVELOPE_MAX_BYTES = 65_536;

export type CustomerImportState =
  | 'UPLOADING'
  | 'QUEUED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'UNDOING'
  | 'UNDONE';

export type CustomerImportOutcome = 'PENDING' | 'CREATED' | 'LINKED' | 'UNCHANGED' | 'SKIPPED';

export interface CustomerImportView {
  id: string;
  state: CustomerImportState;
  totalRows: number;
  uploadedRows: number;
  processedRows: number;
  createdCount: number;
  linkedCount: number;
  unchangedCount: number;
  skippedCount: number;
  errorCode: string | null;
  createdAt: string;
  completedAt: string | null;
  undoDeadline: string | null;
  contentsExpired: boolean;
}

export type CustomerImportErrorCode = 'INVALID_ENVELOPE' | 'PAYLOAD_TOO_LARGE';

export class CustomerImportError extends Error {
  constructor(readonly code: CustomerImportErrorCode) {
    super(code);
    this.name = 'CustomerImportError';
  }
}

export interface CustomerImportStartInput {
  clientRequestId: string;
  totalRows: number;
}

export interface CustomerImportRawRow {
  sourceLine: number;
  firstName: unknown;
  lastName: unknown;
  phone: unknown;
}

export interface CustomerImportChunkInput {
  offset: number;
  rows: CustomerImportRawRow[];
}

export type CustomerImportRowErrorCode =
  | 'INVALID_FIRST_NAME'
  | 'INVALID_LAST_NAME'
  | 'INVALID_PHONE'
  | 'MISSING_NAME_AND_PHONE';

export interface CustomerImportRowValue {
  firstName: string;
  lastName: string | null;
  phone: string | null;
}

export type CustomerImportRowInput = CustomerImportRowValue;

export type CustomerImportRowResult =
  | { ok: true; value: CustomerImportRowValue }
  | { ok: false; code: CustomerImportRowErrorCode };

function envelopeBytes(raw: unknown): number {
  try {
    const serialized = JSON.stringify(raw);
    if (typeof serialized !== 'string') throw new CustomerImportError('INVALID_ENVELOPE');
    return new TextEncoder().encode(serialized).byteLength;
  } catch (error) {
    if (error instanceof CustomerImportError) throw error;
    throw new CustomerImportError('INVALID_ENVELOPE');
  }
}

function boundedEnvelope(raw: unknown): Record<string, unknown> {
  if (envelopeBytes(raw) > CUSTOMER_IMPORT_ENVELOPE_MAX_BYTES) {
    throw new CustomerImportError('PAYLOAD_TOO_LARGE');
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new CustomerImportError('INVALID_ENVELOPE');
  }
  return raw as Record<string, unknown>;
}

export function parseCustomerImportStart(raw: unknown): CustomerImportStartInput {
  const body = boundedEnvelope(raw);
  const clientRequestId = body['clientRequestId'];
  const totalRows = body['totalRows'];
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (typeof clientRequestId !== 'string' || !uuid.test(clientRequestId)
    || !Number.isInteger(totalRows) || (totalRows as number) < 1 || (totalRows as number) > CUSTOMER_IMPORT_MAX_ROWS) {
    throw new CustomerImportError('INVALID_ENVELOPE');
  }
  return { clientRequestId, totalRows: totalRows as number };
}

export function parseCustomerImportChunk(raw: unknown): CustomerImportChunkInput {
  const body = boundedEnvelope(raw);
  const offset = body['offset'];
  const rows = body['rows'];
  if (!Number.isSafeInteger(offset) || (offset as number) < 0 || (offset as number) >= CUSTOMER_IMPORT_MAX_ROWS
    || !Array.isArray(rows) || rows.length < 1 || rows.length > CUSTOMER_IMPORT_CHUNK_MAX_ROWS
    || (offset as number) + rows.length > CUSTOMER_IMPORT_MAX_ROWS) {
    throw new CustomerImportError('INVALID_ENVELOPE');
  }
  const parsedRows = rows.map((rawRow): CustomerImportRawRow => {
    if (!rawRow || typeof rawRow !== 'object' || Array.isArray(rawRow)) {
      throw new CustomerImportError('INVALID_ENVELOPE');
    }
    const row = rawRow as Record<string, unknown>;
    if (!Number.isSafeInteger(row['sourceLine']) || (row['sourceLine'] as number) < 2
      || (row['sourceLine'] as number) > 2_147_483_647) {
      throw new CustomerImportError('INVALID_ENVELOPE');
    }
    return {
      sourceLine: row['sourceLine'] as number,
      firstName: row['firstName'],
      lastName: row['lastName'],
      phone: row['phone'],
    };
  });
  return { offset: offset as number, rows: parsedRows };
}

export function customerImportRowInput(row: CustomerImportRawRow): CustomerImportRowResult {
  if (typeof row.firstName !== 'string') return { ok: false, code: 'INVALID_FIRST_NAME' };
  const firstName = row.firstName.trim();
  if (firstName.length > 100) return { ok: false, code: 'INVALID_FIRST_NAME' };

  if (row.lastName !== null && typeof row.lastName !== 'string') return { ok: false, code: 'INVALID_LAST_NAME' };
  const lastName = typeof row.lastName === 'string' ? row.lastName.trim() : '';
  if (lastName.length > 100) return { ok: false, code: 'INVALID_LAST_NAME' };

  if (row.phone !== null && typeof row.phone !== 'string') return { ok: false, code: 'INVALID_PHONE' };
  const phone = typeof row.phone === 'string' ? row.phone.trim() : '';
  if (phone.length > 32 || (phone && !customerPhoneKey(phone))) return { ok: false, code: 'INVALID_PHONE' };
  if (!firstName && !phone) return { ok: false, code: 'MISSING_NAME_AND_PHONE' };

  return {
    ok: true,
    value: {
      firstName: firstName || 'Клиент',
      lastName: lastName || null,
      phone: phone || null,
    },
  };
}

export function canUndoCustomerImport(undoDeadline: Date | null, now: Date): boolean {
  if (!undoDeadline) return false;
  const deadlineMs = undoDeadline.getTime();
  const nowMs = now.getTime();
  return Number.isFinite(deadlineMs) && Number.isFinite(nowMs) && nowMs < deadlineMs;
}
