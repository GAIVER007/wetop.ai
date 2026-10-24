import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../i18n/server', async () => ({ serverT: async () => (await import('../../i18n')).translator('ru'), currentLocale: async () => 'ru' }));
import { ApiError } from '../../lib/api-error';
import type { CustomerImportView } from '@pms/domain';

const api = vi.hoisted(() => ({
  me: vi.fn(),
  listCustomerImports: vi.fn(),
  getCustomerImport: vi.fn(),
  startCustomerImport: vi.fn(),
  uploadCustomerImportRows: vi.fn(),
  submitCustomerImport: vi.fn(),
  undoCustomerImport: vi.fn(),
}));

vi.mock('../../lib/api', async () => ({
  ApiError: (await import('../../lib/api-error')).ApiError,
  authApi: { me: api.me },
  beautyApi: {
    listCustomerImports: api.listCustomerImports,
    getCustomerImport: api.getCustomerImport,
    startCustomerImport: api.startCustomerImport,
    uploadCustomerImportRows: api.uploadCustomerImportRows,
    submitCustomerImport: api.submitCustomerImport,
    undoCustomerImport: api.undoCustomerImport,
  },
}));

import {
  getCustomerImport,
  listCustomerImports,
  startCustomerImport,
  submitCustomerImport,
  undoCustomerImport,
  uploadCustomerImportRows,
} from './customer-import-actions';

const item: CustomerImportView = {
  id: 'import-1',
  state: 'UPLOADING',
  totalRows: 2,
  uploadedRows: 0,
  processedRows: 0,
  createdCount: 0,
  linkedCount: 0,
  unchangedCount: 0,
  skippedCount: 0,
  errorCode: null,
  createdAt: '2026-10-18T12:00:00.000Z',
  completedAt: null,
  undoDeadline: null,
  contentsExpired: false,
};

beforeEach(() => {
  vi.resetAllMocks();
  api.me.mockResolvedValue({ context: { businessId: 'business' } });
  api.listCustomerImports.mockResolvedValue({ items: [item] });
  api.getCustomerImport.mockResolvedValue(item);
  api.startCustomerImport.mockResolvedValue(item);
  api.uploadCustomerImportRows.mockResolvedValue({ ...item, uploadedRows: 2 });
  api.submitCustomerImport.mockResolvedValue({ ...item, state: 'QUEUED', uploadedRows: 2 });
  api.undoCustomerImport.mockResolvedValue({ ...item, state: 'UNDONE' });
});

describe('Durable customer import server boundary', () => {
  it('lists and reloads only through a checked business scope', async () => {
    await expect(listCustomerImports('business')).resolves.toEqual({ items: [item] });
    await expect(getCustomerImport('business', 'import-1')).resolves.toEqual({ item });
    expect(api.listCustomerImports).toHaveBeenCalledWith();
    expect(api.getCustomerImport).toHaveBeenCalledWith('import-1');
    expect(api.me).toHaveBeenCalledTimes(2);
  });

  it('forwards one stable client request id when an import starts', async () => {
    const input = { clientRequestId: '9ae35152-2aed-48d1-9fb6-b24b733e908a', totalRows: 2 };
    await expect(startCustomerImport('business', input)).resolves.toEqual({ item });
    expect(api.startCustomerImport).toHaveBeenCalledWith(input);
  });

  it('forwards the exact offset and rows so the same package can be retried', async () => {
    const chunk = {
      offset: 0,
      rows: [
        { sourceLine: 2, firstName: 'Тест', lastName: 'Один', phone: '+77000000001' },
        { sourceLine: 3, firstName: 'Клиент', lastName: null, phone: '+77000000002' },
      ],
    };
    await expect(uploadCustomerImportRows('business', 'import-1', chunk)).resolves.toEqual({
      item: { ...item, uploadedRows: 2 },
    });
    expect(api.uploadCustomerImportRows).toHaveBeenCalledWith('import-1', chunk);
  });

  it('checks the current business before every mutation', async () => {
    api.me.mockResolvedValue({ context: { businessId: 'other-business' } });
    const chunk = { offset: 0, rows: [] };

    await expect(startCustomerImport('business', { clientRequestId: crypto.randomUUID(), totalRows: 1 }))
      .resolves.toHaveProperty('error');
    await expect(uploadCustomerImportRows('business', 'import-1', chunk)).resolves.toHaveProperty('error');
    await expect(submitCustomerImport('business', 'import-1')).resolves.toHaveProperty('error');
    await expect(undoCustomerImport('business', 'import-1')).resolves.toHaveProperty('error');

    expect(api.startCustomerImport).not.toHaveBeenCalled();
    expect(api.uploadCustomerImportRows).not.toHaveBeenCalled();
    expect(api.submitCustomerImport).not.toHaveBeenCalled();
    expect(api.undoCustomerImport).not.toHaveBeenCalled();
  });

  it('submits and undoes through their dedicated commands', async () => {
    await expect(submitCustomerImport('business', 'import-1')).resolves.toEqual({
      item: { ...item, state: 'QUEUED', uploadedRows: 2 },
    });
    await expect(undoCustomerImport('business', 'import-1')).resolves.toEqual({
      item: { ...item, state: 'UNDONE' },
    });
    expect(api.submitCustomerImport).toHaveBeenCalledWith('import-1');
    expect(api.undoCustomerImport).toHaveBeenCalledWith('import-1');
  });

  it('keeps expected client errors but never exposes an internal server message', async () => {
    api.submitCustomerImport.mockRejectedValueOnce(new ApiError(409, 'Сначала загрузите все строки'));
    await expect(submitCustomerImport('business', 'import-1')).resolves.toEqual({
      error: 'Сначала загрузите все строки',
    });

    api.submitCustomerImport.mockRejectedValueOnce(new ApiError(500, 'column customer_phone does not exist'));
    await expect(submitCustomerImport('business', 'import-1')).resolves.toEqual({
      error: 'Не удалось подтвердить импорт. Обновите состояние перед повтором.',
    });
  });
});
