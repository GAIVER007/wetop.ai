'use client';
import { Alert, Button } from '../../../../components/ui';
import { useConfirm } from '../../../../components/use-confirm';
import { useFileAction } from '../../budget/drawers';
import { campaignStatusAction } from './actions';

/** «Остановить» и «Включить» кампании из кабинета Meta (§57): сначала Meta, потом статус в WETOP */
export function CampaignStatusButton({ campaignId, name, active }: { campaignId: string; name: string; active: boolean }) {
  const [state, action, pending] = useFileAction(campaignStatusAction);
  const { ask, dialog } = useConfirm();
  return (
    <form action={action}>
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="to" value={active ? 'PAUSED' : 'ACTIVE'} />
      {state.error && <Alert boxed>{state.error}</Alert>}
      <Button
        type="button"
        tone={active ? 'ghost' : 'secondary'}
        size="sm"
        disabled={pending}
        aria-busy={pending}
        data-testid={`campaign-${active ? 'pause' : 'resume'}-${campaignId}`}
        onClick={async (e) => {
          const form = e.currentTarget.form;
          const yes = active
            ? await ask({
                title: `Остановить «${name}»?`,
                body: 'Показы в Meta прекратятся, расход остановится. Включить можно здесь же.',
                confirmLabel: 'Остановить',
                tone: 'danger',
              })
            : true;
          if (yes) form?.requestSubmit();
        }}
      >
        {pending ? (active ? 'Останавливаю…' : 'Включаю…') : active ? 'Остановить' : 'Включить'}
      </Button>
      {dialog}
    </form>
  );
}
