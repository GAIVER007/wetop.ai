'use client';
import { useSyncExternalStore } from 'react';

const QUERY = '(max-width: 600px)';

const WIDE = '(min-width: 1280px)';

const subscribeTo = (query: string) => (change: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', change);
  return () => media.removeEventListener('change', change);
};
const subscribe = subscribeTo(QUERY);
const subscribeWide = subscribeTo(WIDE);

/**
 * Узкий экран (телефон, до 600 px, как в CSS): шапка журнала прячет выборы в «Фильтры» (решение 24.10.2026).
 * На сервере и до первой отрисовки считается широким, чтобы разметка совпала с серверной.
 */
export function useNarrow(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

/** Широкий экран (от 1280 px): у журнала салона панель дня справа от сетки (вариант B, 24.10.2026) */
export function useWide(): boolean {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    () => false,
  );
}
