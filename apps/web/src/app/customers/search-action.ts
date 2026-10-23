'use server';
import { unstable_rethrow } from 'next/navigation';
import { beautyApi } from '../../lib/api';
import { foodApi } from '../../lib/food-api';
import { deskShell } from '../../lib/desk-shell';
import { customerHits, customerQueryReady, type CustomerHit } from '../../lib/customer-hits';

/**
 * Поиск клиентов для окна Ctrl K салона и ресторана (аудит 22.10.2026 P1-4). Направление берётся с сервера,
 * а не из браузера; организацию и бизнес ограничивает API. Гостиница ищет своими ссылками, здесь пусто.
 * Отказ API (нет права на клиентов, нет связи) не роняет окно: разделы остаются, клиентов нет.
 */
export async function searchCustomers(query: string): Promise<CustomerHit[]> {
  if (typeof query !== 'string' || !customerQueryReady(query)) return [];
  const q = query.trim().slice(0, 100);
  const shell = await deskShell();
  try {
    if (shell.vertical === 'BEAUTY')
      return customerHits('BEAUTY', (await beautyApi.customers({ q })).items);
    if (shell.vertical === 'FOOD_SERVICE')
      return customerHits('FOOD_SERVICE', (await foodApi.customers(undefined, q)).items);
  } catch (error) {
    unstable_rethrow(error);
    return [];
  }
  return [];
}
