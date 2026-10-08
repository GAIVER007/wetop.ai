'use client';
import { useActionState, useCallback, useSyncExternalStore } from 'react';
import type { BarActionResult } from './actions';

type Intent = { key: string; payload: Record<string, string> };
const eventName = 'wetop-bar-intent';
const initial: BarActionResult = { error: null, ok: 0 };
const fields = ['receiptId', 'productId', 'folioId', 'quantityUnits', 'amount', 'method', 'note', 'reason'];
function parse(raw: string): Intent | null {
  if (!raw) return null;
  const value = JSON.parse(raw) as Intent;
  if (!value || typeof value.key !== 'string' || !value.key || !value.payload ||
    Object.entries(value.payload).some(([key, text]) => !fields.includes(key) || typeof text !== 'string'))
    throw new Error('Сохранённая операция повреждена. Сначала проверьте её в журнале');
  return value;
}

/** Persist before dispatch; unknown outcomes retain the original immutable parameters. */
export function useBarIntent(scope: string, kind: string, action: (previous: BarActionResult, fd: FormData) => Promise<BarActionResult>, resource = '') {
  const storageKey = `wetop.bar.intent.v1:${scope}:${kind}:${resource}`;
  const subscribe = useCallback((notify: () => void) => {
    const listener = () => notify();
    window.addEventListener('storage', listener);
    window.addEventListener(eventName, listener);
    return () => { window.removeEventListener('storage', listener); window.removeEventListener(eventName, listener); };
  }, []);
  const snapshot = useCallback(() => {
    try { return window.localStorage.getItem(storageKey) ?? ''; }
    catch { return 'unavailable'; }
  }, [storageKey]);
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  let intent: Intent | null = null;
  let storageError: string | null = null;
  try { intent = parse(raw ?? ''); } catch (error) { storageError = error instanceof Error ? error.message : 'Не удалось прочитать операцию'; }
  const notify = () => window.dispatchEvent(new Event(eventName));
  const [state, dispatch, pending] = useActionState(async (previous: BarActionResult, fd: FormData) => {
    try {
      let current = parse(window.localStorage.getItem(storageKey) ?? '');
      if (!current) {
        const payload = Object.fromEntries(fields.filter(field => fd.has(field)).map(field => [field, String(fd.get(field) ?? '')]));
        current = { key: crypto.randomUUID(), payload };
        window.localStorage.setItem(storageKey, JSON.stringify(current));
        notify();
      }
      const request = new FormData();
      Object.entries(current.payload).forEach(([key, value]) => request.set(key, value));
      request.set('idempotencyKey', current.key);
      const result = await action(previous, request);
      if (!result.error && parse(window.localStorage.getItem(storageKey) ?? '')?.key === current.key) {
        window.localStorage.removeItem(storageKey);
        notify();
      }
      return result;
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Результат неизвестен, повторите проверку', ok: previous.ok };
    }
  }, initial);
  const newIntent = () => {
    if (pending) return;
    window.localStorage.removeItem(storageKey);
    notify();
  };
  return { state, dispatch, pending, intent, storageError, ready: raw !== null, newIntent };
}
