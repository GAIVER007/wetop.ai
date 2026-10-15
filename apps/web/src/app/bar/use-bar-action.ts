'use client';
import { startTransition, useActionState, useEffect, useRef, type FormEvent } from 'react';
import type { BarActionResult } from './actions';

/** Submit manually so a rejected command cannot reset an editable draft. */
export function useBarAction(
  command: (state: BarActionResult, data: FormData) => Promise<BarActionResult>,
  initial: BarActionResult,
) {
  const [state, dispatch, pending] = useActionState(command, initial);
  const form = useRef<HTMLFormElement | null>(null);
  useEffect(() => {
    if (state.ok && !state.error) form.current?.reset();
  }, [state.ok, state.error]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    form.current = event.currentTarget;
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  };
  return [state, submit, pending] as const;
}
