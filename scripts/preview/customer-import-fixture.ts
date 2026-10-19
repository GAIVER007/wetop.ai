import { randomUUID } from 'node:crypto';
import {
  customerImportRowInput,
  customerPhoneKey,
  type CustomerImportRawRow,
  type CustomerImportView,
} from '@pms/domain';

export interface CustomerImportFixtureProfile {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string;
  status: string;
  businessIds: string[];
}

export interface CustomerImportFixtureRequest {
  path: string;
  method: string | undefined;
  body: Record<string, unknown>;
  businessId: string;
  role: string;
  customerProfiles: CustomerImportFixtureProfile[];
}

export interface CustomerImportFixtureResponse {
  status: number;
  body: unknown;
}

type Run = CustomerImportView & {
  clientRequestId: string;
  rows: CustomerImportRawRow[];
  receipts: Map<number, string>;
  createdIds: string[];
  linkedIds: string[];
  businessId: string;
};

const runs = new Map<string, Run>();
const reply = (status: number, body: unknown): CustomerImportFixtureResponse => ({ status, body });
const view = (run: Run): CustomerImportView => ({
  id: run.id,
  state: run.state,
  totalRows: run.totalRows,
  uploadedRows: run.uploadedRows,
  processedRows: run.processedRows,
  createdCount: run.createdCount,
  linkedCount: run.linkedCount,
  unchangedCount: run.unchangedCount,
  skippedCount: run.skippedCount,
  errorCode: run.errorCode,
  createdAt: run.createdAt,
  completedAt: run.completedAt,
  undoDeadline: run.undoDeadline,
  contentsExpired: run.contentsExpired,
});

export function resetCustomerImportFixture() {
  runs.clear();
}

/** Isolated in-memory routes for Playwright only. Production behavior remains in apps/api. */
export function customerImportFixture(request: CustomerImportFixtureRequest): CustomerImportFixtureResponse | null {
  const { path, method, body, businessId, role, customerProfiles } = request;
  if (!path.startsWith('/beauty/customer-imports')) return null;
  if (role !== 'OWNER') return reply(403, { message: 'Импорт клиентов доступен только владельцу' });
  if (!businessId) return reply(403, { message: 'Выберите бизнес салона' });

  if (path === '/beauty/customer-imports' && method === 'GET') {
    const items = [...runs.values()]
      .filter((run) => run.businessId === businessId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(view);
    return reply(200, { items });
  }

  if (path === '/beauty/customer-imports' && method === 'POST') {
    const clientRequestId = String(body['clientRequestId'] ?? '');
    const totalRows = Number(body['totalRows']);
    if (!clientRequestId || !Number.isInteger(totalRows) || totalRows < 1 || totalRows > 50_000)
      return reply(400, { message: 'Проверьте данные импорта' });
    const prior = [...runs.values()].find((run) => run.clientRequestId === clientRequestId);
    if (prior) return prior.businessId === businessId && prior.totalRows === totalRows
      ? reply(200, view(prior))
      : reply(409, { message: 'Идентификатор уже использован для другого импорта' });
    const id = randomUUID();
    const run: Run = {
      id, clientRequestId, businessId, state: 'UPLOADING', totalRows, uploadedRows: 0, processedRows: 0,
      createdCount: 0, linkedCount: 0, unchangedCount: 0, skippedCount: 0, errorCode: null,
      createdAt: new Date().toISOString(), completedAt: null, undoDeadline: null, contentsExpired: false,
      rows: [], receipts: new Map(), createdIds: [], linkedIds: [],
    };
    runs.set(id, run);
    return reply(201, view(run));
  }

  const rowsMatch = /^\/beauty\/customer-imports\/([^/]+)\/rows$/.exec(path);
  if (rowsMatch && method === 'PUT') {
    const run = runs.get(rowsMatch[1]!);
    if (!run || run.businessId !== businessId) return reply(404, { message: 'Импорт не найден' });
    const offset = Number(body['offset']);
    const rows = Array.isArray(body['rows']) ? body['rows'] as CustomerImportRawRow[] : [];
    const receipt = JSON.stringify({ offset, rows });
    const prior = run.receipts.get(offset);
    if (prior) return prior === receipt
      ? reply(200, view(run))
      : reply(409, { message: 'Часть уже загружена с другими данными' });
    if (run.state !== 'UPLOADING') return reply(409, { message: 'Загрузка уже закрыта' });
    if (offset !== run.uploadedRows) return reply(409, { message: 'Загрузите предыдущую часть импорта' });
    if (!rows.length || rows.length > 1000 || offset + rows.length > run.totalRows)
      return reply(400, { message: 'Проверьте данные части импорта' });
    run.rows.push(...rows);
    run.uploadedRows += rows.length;
    run.receipts.set(offset, receipt);
    return reply(200, view(run));
  }

  const commandMatch = /^\/beauty\/customer-imports\/([^/]+)\/(submit|undo)$/.exec(path);
  if (commandMatch && method === 'POST') {
    const run = runs.get(commandMatch[1]!);
    if (!run || run.businessId !== businessId) return reply(404, { message: 'Импорт не найден' });
    if (commandMatch[2] === 'undo') {
      if (run.state !== 'COMPLETED' || !run.undoDeadline || Date.now() >= Date.parse(run.undoDeadline))
        return reply(409, { message: 'Срок безопасной отмены истёк или импорт не завершён' });
      for (const id of run.linkedIds) {
        const profile = customerProfiles.find((row) => row.id === id);
        if (profile) profile.businessIds = profile.businessIds.filter((value) => value !== businessId);
      }
      for (const id of run.createdIds) {
        const index = customerProfiles.findIndex((row) => row.id === id);
        if (index >= 0) customerProfiles.splice(index, 1);
      }
      run.state = 'UNDONE';
      return reply(200, view(run));
    }
    if (run.uploadedRows !== run.totalRows) return reply(409, { message: 'Загрузите все строки перед запуском' });
    if (run.state !== 'UPLOADING') return reply(200, view(run));
    for (const raw of run.rows) {
      const parsed = customerImportRowInput(raw);
      if (!parsed.ok) { run.skippedCount += 1; continue; }
      const row = parsed.value;
      const key = customerPhoneKey(row.phone);
      const known = key ? customerProfiles.find((profile) => customerPhoneKey(profile.phone) === key) : undefined;
      if (known) {
        if (known.businessIds.includes(businessId)) run.unchangedCount += 1;
        else { known.businessIds.push(businessId); run.linkedIds.push(known.id); run.linkedCount += 1; }
      } else {
        const id = randomUUID();
        customerProfiles.push({
          id, firstName: row.firstName, lastName: row.lastName, phone: row.phone ?? '',
          status: 'ACTIVE', businessIds: [businessId],
        });
        run.createdIds.push(id);
        run.createdCount += 1;
      }
      run.processedRows += 1;
    }
    run.processedRows += run.skippedCount;
    run.state = 'COMPLETED';
    run.completedAt = new Date().toISOString();
    run.undoDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    return reply(200, view(run));
  }

  const getMatch = /^\/beauty\/customer-imports\/([^/]+)$/.exec(path);
  if (getMatch && method === 'GET') {
    const run = runs.get(getMatch[1]!);
    return run && run.businessId === businessId
      ? reply(200, view(run))
      : reply(404, { message: 'Импорт не найден' });
  }
  return reply(404, { message: 'Маршрут импорта не найден' });
}
