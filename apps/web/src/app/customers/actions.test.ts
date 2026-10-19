import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api-error';
vi.mock('server-only', () => ({}));
const { me, createCustomer, revalidatePath } = vi.hoisted(() => ({
  me: vi.fn(), createCustomer: vi.fn(), revalidatePath: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('../../lib/api', async () => ({
  ApiError: (await import('../../lib/api-error')).ApiError,
  authApi: { me }, beautyApi: { createCustomer },
}));
import { createBeautyCustomerState } from './actions';

const form = () => {
  const data = new FormData();
  for (const [key, value] of Object.entries({ businessId: 'business', firstName: 'Тест', lastName: '', phone: '7000001001' })) data.set(key, value);
  return data;
};
beforeEach(() => {
  vi.resetAllMocks();
  me.mockResolvedValue({ context: { businessId: 'business' } });
  createCustomer.mockResolvedValue({ id: 'customer', created: true });
});
describe('Самостоятельное создание клиента: server action', () => {
  it('сохраняет и обновляет список клиентов', async () => {
    expect(await createBeautyCustomerState(null, form())).toEqual({ id: 'customer', created: true });
    expect(createCustomer).toHaveBeenCalledWith({ firstName: 'Тест', lastName: '', phone: '7000001001' });
    expect(revalidatePath).toHaveBeenCalledWith('/customers');
  });
  it('останавливает устаревшую форму после смены бизнеса', async () => {
    me.mockResolvedValue({ context: { businessId: 'other-business' } });
    expect(await createBeautyCustomerState(null, form())).toHaveProperty('error');
    expect(createCustomer).not.toHaveBeenCalled();
  });
  it('показывает ошибку API и не обновляет список при отказе', async () => {
    createCustomer.mockRejectedValue(new ApiError(409, 'Клиент в архиве'));
    expect(await createBeautyCustomerState(null, form())).toEqual({ error: 'Клиент в архиве' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
