import { BRANCH_PAYMENT_METHODS, CONFIGURABLE_PAYMENT_METHODS } from '@pms/domain';
import type { Db } from '@pms/database';

/**
 * С 27.10.2026 Kaspi и Halyk без строки настройки выключены (NO-KZ-METHODS-20261027). Наборы, которые проверяют
 * деньги этими способами, играют филиал или объект, который сам их включил: строки настройки, как сохранила бы
 * страница «Способы оплаты». «Другое» остаётся выключенным, как без строк.
 */
export async function enableKzBranchMethods(db: Db, locationIds: readonly string[]): Promise<void> {
  await db.branchPaymentMethodSetting.createMany({
    data: locationIds.flatMap((locationId) =>
      BRANCH_PAYMENT_METHODS.map((method, sortOrder) => ({ locationId, method, enabled: method !== 'OTHER', sortOrder })),
    ),
  });
}

export async function enableKzPropertyMethods(db: Db, propertyId: string): Promise<void> {
  await db.paymentMethodSetting.createMany({
    data: CONFIGURABLE_PAYMENT_METHODS.map((method, sortOrder) => ({ propertyId, method, enabled: true, sortOrder })),
  });
}
