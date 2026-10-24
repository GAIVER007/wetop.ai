'use client';
import { useSyncExternalStore } from 'react';

const QUERY = '(max-width: 600px)';

function subscribe(change: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', change);
  return () => media.removeEventListener('change', change);
}

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
