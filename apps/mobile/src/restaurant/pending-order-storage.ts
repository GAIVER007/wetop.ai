import { uuid } from 'expo';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { PendingOrderStore } from './pending-order';
export type PendingOrderContext = {
  userId: string;
  organizationId: string;
  businessId: string;
  locationId: string;
};
/** Scope contains verified account/branch identifiers, never the token or session issuance time. */
export function createPendingOrderStore(
  environment: string,
  scope: PendingOrderContext,
): PendingOrderStore {
  if (Platform.OS === 'web')
    throw new Error('Надёжная отправка заказа доступна в установленном приложении.');
  const context = JSON.stringify([
    environment,
    scope.userId,
    scope.organizationId,
    scope.businessId,
    scope.locationId,
  ]);
  const prefix = `ai.wetop.mobile.order.${uuid.v5(context, '6ba7b810-9dad-11d1-80b4-00c04fd430c8')}`;
  return new PendingOrderStore(
    {
      get: (key) => SecureStore.getItemAsync(key),
      set: (key, value) =>
        SecureStore.setItemAsync(key, value, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        }),
      remove: (key) => SecureStore.deleteItemAsync(key),
    },
    prefix,
    context,
    () => uuid.v4(),
  );
}
