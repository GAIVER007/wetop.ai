import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { TokenStore } from './contracts';
// Web preview is memory-only: never persist native credentials in browser storage.
export function tokenStore(environment: string): TokenStore {
  let memory: string | null = null;
  const key = `ai.wetop.mobile.session.${encodeURIComponent(environment).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  if (Platform.OS === 'web')
    return {
      read: async () => memory,
      write: async (token) => {
        memory = token;
      },
      clear: async () => {
        memory = null;
      },
    };
  return {
    read: () => SecureStore.getItemAsync(key),
    write: (token) =>
      SecureStore.setItemAsync(key, token, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      }),
    clear: () => SecureStore.deleteItemAsync(key),
  };
}
