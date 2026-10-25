'use server';

import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { beautyPermissionScope, can, parseMembershipRole } from '@pms/domain';
import { ApiError } from '../../lib/api-error';
import { currentMe } from '../../lib/desk-shell';
import { readOnlyOf } from '../../lib/desk-person';
import { restaurantApi } from '../../lib/food-api';
import type { FoodCashOperationInput, FoodPaymentMethod } from '../../lib/food-types';
import { serverT } from '../../i18n/server';

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
  const t = await serverT();
  try {
    const me = await currentMe();
    const c = me.context;
    if (
      !c?.businessId ||
      !c.locationId ||
      !['BEAUTY', 'FOOD_SERVICE'].includes(c.vertical ?? '') ||
      scopeKey !== `${c.businessId}:${c.locationId}`
    )
      throw new ApiError(409, t('Выбран другой филиал. Откройте форму заново.'));
    // В салоне с назначенными должностями решает должность, как в API (request-context.ts): операция —
    // finance.create, возврат — finance.refund, сверка — finance.update. Иначе — старая роль, как раньше.
    const assigned = c.vertical === 'BEAUTY' && me.beautyAccess?.mode === 'ASSIGNED';
    const allowed = assigned
      ? beautyPermissionScope(
          me.beautyAccess!.permissions,
          'finance',
          command.kind === 'void' ? 'refund' : command.kind === 'reconcile' ? 'update' : 'create',
        ) !== null
      : (() => {
          const role = me.user?.role ? parseMembershipRole(me.user.role) : null;
          return role !== null && can(role, command.kind === 'void' ? 'refunds' : 'desk');
        })();
    if (!allowed || readOnlyOf(me.user?.organization, new Date()))
      throw new ApiError(403, t('Нет права на эту кассовую операцию.'));
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
          : t('Не удалось подтвердить операцию. Повторите с тем же черновиком.'),
    };
  }
}
