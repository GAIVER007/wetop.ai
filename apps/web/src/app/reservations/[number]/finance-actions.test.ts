import { afterEach, expect, it, vi } from 'vitest';
import { payGroupAction } from './finance-actions';
import { ApiError, financeApi } from '../../../lib/api';
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
afterEach(() => vi.restoreAllMocks());

it('отправляет один платёж с распределениями и сохраняет ввод при отказе API', async () => {
  const pay = vi
    .spyOn(financeApi, 'pay')
    .mockRejectedValue(new ApiError(422, 'Суммы не совпадают'));
  const fd = new FormData();
  Object.entries({
    method: 'CASH',
    amount: '10000.25',
    note: 'Тест группы',
    'allocation.f1': '8000.25',
    'allocation.f2': '2000',
    'allocation.f3': '',
    'allocation.untrusted': '100',
  }).forEach(([k, v]) => fd.set(k, v));
  const result = await payGroupAction('TEST', ['f1', 'f2', 'f3'], { error: null, ok: 0 }, fd);
  expect(pay).toHaveBeenCalledWith({
    method: 'CASH',
    amount: '10000.25',
    note: 'Тест группы',
    allocations: [
      { folioId: 'f1', amount: '8000.25' },
      { folioId: 'f2', amount: '2000' },
    ],
  });
  expect(result).toMatchObject({
    error: 'Суммы не совпадают',
    values: { amount: '10000.25', 'allocation.f2': '2000' },
  });
});

it('сохраняет поля отдельной оплаты после отказа и сбрасывает их только после успеха', async () => {
  const { payAction } = await import('./finance-actions');
  const pay = vi.spyOn(financeApi, 'pay').mockRejectedValueOnce(new ApiError(503, 'Недоступно'));
  const fd = new FormData();
  fd.set('amount', '3456.78');
  fd.set('method', 'KASPI');
  fd.set('note', 'Сохранить ввод');
  fd.set('unexpected', 'Не возвращать');
  const failed = await payAction('TEST', 'folio', { error: null, ok: 0 }, fd);
  expect(failed).toMatchObject({
    error: 'Недоступно',
    attempt: 1,
    values: { amount: '3456.78', method: 'KASPI', note: 'Сохранить ввод' },
  });
  expect(failed.values).not.toHaveProperty('unexpected');
  pay.mockResolvedValueOnce({} as Awaited<ReturnType<typeof financeApi.pay>>);
  const success = await payAction('TEST', 'folio', failed, fd);
  expect(success).toMatchObject({ error: null });
  expect(success.values).toBeUndefined();
});
