'use client';
import { Alert, Button } from '../../../../components/ui';
import { useConfirm } from '../../../../components/use-confirm';
import { useFileAction } from '../../budget/drawers';
import { campaignStatusAction } from './actions';
import { useT } from '../../../../i18n/locale-provider';

/** «Остановить» и «Включить» кампании из кабинета Meta (§57): сначала Meta, потом статус в WETOP */
export function CampaignStatusButton({ campaignId, name, active }: { campaignId: string; name: string; active: boolean }) {
  const [state, action, pending] = useFileAction(campaignStatusAction);
  const { ask, dialog } = useConfirm();
  const t = useT();
  return (
    <form action={action}>
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="to" value={active ? 'PAUSED' : 'ACTIVE'} />
      {state.error && <Alert boxed>{t(state.error)}</Alert>}
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
                title: t('Остановить «{name}»?', { name }),
                body: t('Показы в Meta прекратятся, расход остановится. Включить можно здесь же.'),
                confirmLabel: t('Остановить'),
                tone: 'danger',
              })
            : true;
          if (yes) form?.requestSubmit();
        }}
      >
        {pending ? (active ? t('Останавливаю…') : t('Включаю…')) : active ? t('Остановить') : t('Включить')}
      </Button>
      {dialog}
    </form>
  );
}
