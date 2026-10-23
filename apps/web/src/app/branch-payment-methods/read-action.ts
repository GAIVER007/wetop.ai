'use server';
import { restaurantApi } from '../../lib/food-api';

/** Включённые способы оплаты филиала в порядке показа (§21.7); `null`, если список не прочитан */
export async function readBranchPaymentMethods(): Promise<string[] | null> {
  try {
    const { methods } = await restaurantApi.paymentMethods();
    return methods.filter((m) => m.enabled).map((m) => m.method);
  } catch {
    return null;
  }
}
