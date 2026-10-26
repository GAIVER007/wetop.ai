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
import { DraftStore } from '../restaurant/draft-store';
import { tokenStore } from './storage';
const Context = createContext<{
  session: SessionController;
  draft: DraftStore;
  reset: (email: string) => Promise<void>;
} | null>(null);
export function AccessProvider({ children }: { children: ReactNode }) {
  const [value] = useState(() => {
    const base = process.env.EXPO_PUBLIC_MOBILE_API_URL ?? '';
    const api = createAccessApi(base);
    return {
      draft: new DraftStore(),
      session: new SessionController(api, tokenStore(base || 'unconfigured')),
      reset: api.reset,
    };
  });
  useEffect(() => {
    const syncDraft = () => {
      const state = value.session.state;
      if (state.kind === 'ready') value.draft.bind(state.identity);
      else if (state.kind !== 'loading') value.draft.bind(null);
    };
    const unsubscribe = value.session.subscribe(syncDraft);
    void value.session.start();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && value.session.state.kind === 'ready') void value.session.retry();
    });
    return () => {
      sub.remove();
      unsubscribe();
    };
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
