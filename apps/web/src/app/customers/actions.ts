'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, authApi, beautyApi } from '../../lib/api';

export interface CreateCustomerState {
  error?: string;
  id?: string;
  created?: boolean;
}

export async function createBeautyCustomer(
  _previous: CreateCustomerState | null,
  form: FormData,
): Promise<CreateCustomerState> {
  const text = (key: string) => {
    const value = form.get(key);
    return typeof value === 'string' ? value : '';
  };
  try {
    const expectedBusinessId = text('businessId');
    const { context } = await authApi.me();
    if (!expectedBusinessId || context?.businessId !== expectedBusinessId)
      return { error: 'Бизнес изменён. Закройте форму и откройте её в текущем салоне.' };
    const result = await beautyApi.createCustomer({
      firstName: text('firstName'), lastName: text('lastName'), phone: text('phone'),
    });
    revalidatePath('/customers');
    return result;
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
}

/** VIP и день рождения клиента салона (§36): ответ API словами, как у ресторана */
export async function markBeautyCustomer(
  id: string,
  body: { isVip: boolean; birthDate: string | null },
): Promise<{ error: string | null }> {
  try {
    await beautyApi.updateCustomer(id, body);
    revalidatePath('/customers');
    return { error: null };
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
}
