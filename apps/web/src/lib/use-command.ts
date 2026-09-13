'use client';
import { useRef, useState } from 'react';
/** Lock synchronously, before React paints disabled: one command per control group. */
export function useCommand<T extends { error: string | null }>(initial: T) {
  const [state, setState] = useState(initial);
  const [pending, setPending] = useState(false);
  const locked = useRef(false);
  const run = async (command: () => Promise<T>) => {
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    setState((prev) => ({ ...prev, error: null }));
    try {
      setState(await command());
    } catch {
      // A transport failure can happen after a successful write. Never retry it automatically.
      setState({
        ...initial,
        error: 'Ответ сервера не получен. Обновите данные и проверьте результат операции.',
      });
    } finally {
      locked.current = false;
      setPending(false);
    }
  };
  return { state, setState, run, pending };
}
