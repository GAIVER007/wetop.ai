'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, beautyApi } from '../../lib/api';

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
