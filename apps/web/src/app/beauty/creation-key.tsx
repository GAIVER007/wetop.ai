'use client';
import { useEffect, useState } from 'react';
import { useT } from '../../i18n/locale-provider';
const storageKey = (scope: string, kind: string) => `wetop:beauty:create:${scope}:${kind}`;
export function pendingCreation(scope: string, kind: string): string | null {
  try {
    return sessionStorage.getItem(storageKey(scope, kind));
  } catch {
    return null;
  }
}
export function clearPendingCreation(scope: string, kind: string, expectedId: string) {
  try {
    const key = storageKey(scope, kind);
    if (sessionStorage.getItem(key) === expectedId) sessionStorage.removeItem(key);
  } catch {
    /* keep the key for a later confirmed recovery */
  }
}
/** Stores only an opaque operation ID, never form fields or contacts. */
export function useCreationKey(scope: string, kind: string, existing: boolean) {
  const [id, setId] = useState('');
  const [error, setError] = useState('');
  const t = useT();
  useEffect(() => {
    if (existing) return;
    try {
      if (!scope) throw new Error('scope');
      const saved = pendingCreation(scope, kind) ?? crypto.randomUUID();
      sessionStorage.setItem(storageKey(scope, kind), saved);
      setId(saved);
    } catch {
      setError(
        t('Для безопасного продолжения разрешите хранение данных этой вкладки. Объект ещё не создан.'),
      );
    }
  }, [scope, kind, existing, t]);
  const clear = () => {
    try {
      clearPendingCreation(scope, kind, id);
    } catch {
      /* no mutation */
    }
  };
  return { id, error, clear };
}
