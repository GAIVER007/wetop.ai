'use server';

import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { can, parseMembershipRole } from '@pms/domain';
import { ApiError } from '../../lib/api-error';
import { currentMe } from '../../lib/desk-shell';
import { readOnlyOf } from '../../lib/desk-person';
import { restaurantApi } from '../../lib/food-api';
import type { FoodCashOperationInput, FoodPaymentMethod } from '../../lib/food-types';

type CashCommand =
  | { kind: 'operation'; body: FoodCashOperationInput }
  | { kind: 'void'; id: string }
  | {
      kind: 'reconcile';
      body: { method: FoodPaymentMethod; counted: number; note?: string | null };
    };

/** Branch cash capability only. The API independently enforces live tenant/scope/permission and locks. */
export async function mutateCash(
  scopeKey: string,
  command: CashCommand,
): Promise<{ error: string | null }> {
  try {
    const me = await currentMe();
    const c = me.context;
    if (
      !c?.businessId ||
      !c.locationId ||
      !['BEAUTY', 'FOOD_SERVICE'].includes(c.vertical ?? '') ||
      scopeKey !== `${c.businessId}:${c.locationId}`
    )
      throw new ApiError(409, 'Выбран другой филиал. Откройте форму заново.');
    const role = me.user?.role ? parseMembershipRole(me.user.role) : null;
    if (
      !role ||
      !can(role, command.kind === 'void' ? 'refunds' : 'desk') ||
      readOnlyOf(me.user?.organization, new Date())
    )
      throw new ApiError(403, 'Нет права на эту кассовую операцию.');
    // Reuse existing branch-ledger endpoints; no restaurant menu/order capability is granted here.
    if (command.kind === 'operation') await restaurantApi.cashOperation(command.body);
    else if (command.kind === 'void') await restaurantApi.voidCashOperation(command.id);
    else await restaurantApi.cashReconciliation(command.body);
    revalidatePath('/cashbox');
    return { error: null };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Не удалось подтвердить операцию. Повторите с тем же черновиком.',
    };
  }
}
