import { uuid } from 'expo';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { PendingOrderContext } from './pending-order-storage';
import { PendingPaymentStore } from './pending-payment';
export function createPendingPaymentStore(
  environment: string,
  scope: PendingOrderContext,
): PendingPaymentStore {
  if (Platform.OS === 'web') throw new Error('Приём оплаты доступен в установленном приложении.');
  const context = uuid.v5(
    JSON.stringify([
      environment,
      scope.userId,
      scope.organizationId,
      scope.businessId,
      scope.locationId,
    ]),
    '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  );
  return new PendingPaymentStore(
    {
      get: (key) => SecureStore.getItemAsync(key),
      set: (key, value) =>
        SecureStore.setItemAsync(key, value, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        }),
      remove: (key) => SecureStore.deleteItemAsync(key),
    },
    `ai.wetop.mobile.payment.${context}`,
    context,
    () => uuid.v4(),
  );
}
