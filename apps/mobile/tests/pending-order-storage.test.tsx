import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createPendingOrderStore } from '../src/restaurant/pending-order-storage';
jest.mock('expo', () => ({
  uuid: { v4: () => 'attempt-native', v5: (value: string) => value.replace(/[^a-zA-Z0-9]/g, '_') },
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
}));
const context = {
  userId: 'user',
  organizationId: 'org',
  businessId: 'business',
  locationId: 'location',
};
test('native attempts use device-only protected storage with environment and account scope', async () => {
  const data = new Map<string, string>();
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key) => data.get(key) ?? null);
  jest.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => {
    data.set(key, value);
  });
  const store = createPendingOrderStore('https://fixture.invalid', context);
  await store.prepare({
    tableId: null,
    guestCount: 1,
    items: [{ menuItemId: '11111111-1111-4111-8111-111111111111', qty: 1, modifierIds: [] }],
  });
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(expect.any(String), expect.any(String), {
    keychainAccessible: 'device-only',
  });
  expect(await createPendingOrderStore('https://another.invalid', context).read()).toBeNull();
  expect(
    await createPendingOrderStore('https://fixture.invalid', {
      ...context,
      userId: 'other',
    }).read(),
  ).toBeNull();
});
test('web cannot silently substitute volatile storage for a durable send attempt', () => {
  const original = Platform.OS;
  Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
  try {
    expect(() => createPendingOrderStore('https://fixture.invalid', context)).toThrow();
  } finally {
    Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
  }
});
