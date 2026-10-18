import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import {
  applyBeautyCustomerImport,
  createBeautyCustomer,
  previewBeautyCustomerImport,
} from './actions';

const { createCustomer, previewCustomerImport, importCustomers, deskShell } = vi.hoisted(() => ({
  createCustomer: vi.fn(),
  previewCustomerImport: vi.fn(),
  importCustomers: vi.fn(),
  deskShell: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('../../lib/desk-shell', () => ({ deskShell }));
vi.mock('../../lib/api', () => ({
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  },
  beautyApi: { createCustomer, previewCustomerImport, importCustomers },
}));

const staleForm = () => {
  const form = new FormData();
  form.set('scopeKey', 'business-old:location-old');
  return form;
};

describe('D1/D2: смена филиала не переносит незавершённое действие клиента', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deskShell.mockResolvedValue({ scopeKey: 'business-new:location-new' });
  });

  it('отклоняет создание, предпросмотр и импорт до вызова API', async () => {
    const results = await Promise.all([
      createBeautyCustomer(staleForm()),
      previewBeautyCustomerImport(staleForm()),
      applyBeautyCustomerImport(staleForm()),
    ]);
    for (const result of results) expect(result.error).toMatch(/Филиал изменился/i);
    expect(createCustomer).not.toHaveBeenCalled();
    expect(previewCustomerImport).not.toHaveBeenCalled();
    expect(importCustomers).not.toHaveBeenCalled();
  });

  it('в текущем филиале разбирает настоящий XLSX и только затем вызывает API', async () => {
    deskShell.mockResolvedValue({ scopeKey: 'business-new:location-new' });
    createCustomer.mockResolvedValue({ id: 'customer-created' });
    previewCustomerImport.mockResolvedValue({ rows: [], totals: { create: 0, alreadyExists: 0, conflicts: 0, duplicatesInFile: 0 } });
    importCustomers.mockResolvedValue({ created: 1, linked: 1, alreadyExists: 0 });

    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([['Имя', 'Телефон'], ['Алия Ким', '+77000000001']]),
      'Клиенты',
    );
    const bytes = XLSX.write(book, { bookType: 'xlsx', type: 'buffer' });
    const xlsx = new File(
      [bytes],
      'clients.xlsx',
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    );
    const fileForm = () => {
      const form = new FormData();
      form.set('scopeKey', 'business-new:location-new');
      form.set('file', xlsx);
      return form;
    };
    const createForm = new FormData();
    createForm.set('scopeKey', 'business-new:location-new');
    createForm.set('firstName', 'Алия');
    createForm.set('lastName', 'Ким');
    createForm.set('phone', '+77000000001');

    await createBeautyCustomer(createForm);
    await previewBeautyCustomerImport(fileForm());
    await applyBeautyCustomerImport(fileForm());

    expect(createCustomer).toHaveBeenCalledOnce();
    expect(previewCustomerImport).toHaveBeenCalledWith(expect.stringContaining('Алия Ким;+77000000001'));
    expect(importCustomers).toHaveBeenCalledWith(expect.stringContaining('Алия Ким;+77000000001'));
  });
});
