import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { createAccessApi } from './api';
import { SessionController } from './session';
import { tokenStore } from './storage';
const Context = createContext<{
  session: SessionController;
  reset: (email: string) => Promise<void>;
} | null>(null);
export function AccessProvider({ children }: { children: ReactNode }) {
  const [value] = useState(() => {
    const base = process.env.EXPO_PUBLIC_MOBILE_API_URL ?? '';
    const api = createAccessApi(base);
    return {
      session: new SessionController(api, tokenStore(base || 'unconfigured')),
      reset: api.reset,
    };
  });
  useEffect(() => {
    void value.session.start();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && value.session.state.kind === 'ready') void value.session.retry();
    });
    return () => sub.remove();
  }, [value]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAccess() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('AccessProvider required');
  const state = useSyncExternalStore(
    ctx.session.subscribe,
    ctx.session.snapshot,
    ctx.session.snapshot,
  );
  return { ...ctx, state };
}
