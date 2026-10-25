'use server';
import { getJsonPublic, sendJson } from '../../lib/api';
import { ApiError } from '../../lib/api-error';
import { currentMe } from '../../lib/desk-shell';
import type { CashRegisterView } from '../../lib/cash-register';

async function assertScope(scopeKey: string) {
  const me = await currentMe();
  if (!me.user || `${me.context?.businessId}:${me.context?.locationId}` !== scopeKey)
    throw new Error('Филиал изменился. Откройте кассу заново');
}
export async function loadCashHeader(scopeKey: string): Promise<CashRegisterView> {
  await assertScope(scopeKey);
  return getJsonPublic<CashRegisterView>('/cash-register');
}
export async function sendCashHeader(
  scopeKey: string,
  body: Record<string, unknown>,
): Promise<{ data?: CashRegisterView; error?: string; uncertain?: boolean }> {
  try {
    await assertScope(scopeKey);
    return { data: await sendJson<CashRegisterView>('POST', '/cash-register/command', body) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Не удалось сохранить кассу',
      uncertain: !(error instanceof ApiError && error.status >= 400 && error.status < 500),
    };
  }
}
export async function saveCashiers(scopeKey: string, userIds: string[]): Promise<CashRegisterView> {
  await assertScope(scopeKey);
  return sendJson<CashRegisterView>('POST', '/cash-register/cashiers', { userIds });
}
