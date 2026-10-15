'use client';
import { useActionState, type ReactNode } from 'react';
import { BarContextFields, type BarFormContext } from './context';
import type { BarActionResult } from './actions';
export function BarCommandForm({
  context,
  action,
  children,
}: {
  context: BarFormContext;
  action: (fd: FormData) => Promise<BarActionResult>;
  children: ReactNode;
}) {
  const [state, submit, pending] = useActionState(
    async (_previous: BarActionResult, fd: FormData) => action(fd),
    { error: null, ok: 0 },
  );
  return (
    <form action={submit}>
      <BarContextFields context={context} />
      <fieldset disabled={pending} className="bar-command-fields">
        {children}
      </fieldset>
      {state.error && (
        <p role="alert" className="bar-error">
          {state.error}
        </p>
      )}
      {state.message && <p role="status">{state.message}</p>}
    </form>
  );
}
