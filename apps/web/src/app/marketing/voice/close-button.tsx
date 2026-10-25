'use client';
import { Alert, Button } from '../../../components/ui';
import { useFileAction } from '../budget/drawers';
import { closeCallbackAction } from './actions';
import { useT } from '../../../i18n/locale-provider';

/** «Отметить обработанной» у просьбы перезвонить: администратор уже связался с клиентом */
export function CloseCallbackButton({ id, name }: { id: string; name: string }) {
  const t = useT();
  const [state, action, pending] = useFileAction(closeCallbackAction);
  return (
    <form action={action}>
      <input type="hidden" name="callbackId" value={id} />
      {state.error && <Alert boxed>{t(state.error)}</Alert>}
      <Button
        type="submit"
        tone="secondary"
        size="sm"
        disabled={pending}
        aria-busy={pending}
        aria-label={t('Отметить обработанной: {name}', { name: name || t('просьба') })}
        data-testid={`voice-callback-close-${id}`}
      >
        {pending ? t('Сохраняю…') : t('Отметить обработанной')}
      </Button>
    </form>
  );
}
