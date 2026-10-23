'use client';
import { Alert, Button } from '../../../components/ui';
import { useFileAction } from '../budget/drawers';
import { closeCallbackAction } from './actions';

/** «Отметить обработанной» у просьбы перезвонить: администратор уже связался с клиентом */
export function CloseCallbackButton({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useFileAction(closeCallbackAction);
  return (
    <form action={action}>
      <input type="hidden" name="callbackId" value={id} />
      {state.error && <Alert boxed>{state.error}</Alert>}
      <Button
        type="submit"
        tone="secondary"
        size="sm"
        disabled={pending}
        aria-busy={pending}
        aria-label={`Отметить обработанной: ${name || 'просьба'}`}
        data-testid={`voice-callback-close-${id}`}
      >
        {pending ? 'Сохраняю…' : 'Отметить обработанной'}
      </Button>
    </form>
  );
}
