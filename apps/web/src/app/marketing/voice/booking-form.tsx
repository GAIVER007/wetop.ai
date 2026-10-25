'use client';
import { Alert, Button, Field, Input } from '../../../components/ui';
import { Switch } from '../../../components/switch';
import type { VoiceBookingView } from '../../../lib/api';
import { useFileAction } from '../budget/drawers';
import { saveBookingAction } from './actions';
import { bookingHint } from './format';
import { useT } from '../../../i18n/locale-provider';

/**
 * «Бронировать по телефону» (срез 4): выключатель и лимит за звонок. Включить можно, только когда агент действует и у направления есть
 * данные для брони; пока нельзя, причины названы словами. Выключить можно всегда.
 */
export function BookingForm({ view, editable }: { view: VoiceBookingView; editable: boolean }) {
  const t = useT();
  const [state, action, pending] = useFileAction(saveBookingAction);
  const locked = !editable || !view.hasAgent;
  return (
    <form action={action} className="panel marketing-screen__stack" data-testid="voice-booking">
      <h2 className="marketing-screen__title">{t('Бронировать по телефону')}</h2>
      <p className="settings-note">{t(bookingHint(view.vertical))}</p>
      {state.error && <Alert boxed>{t(state.error)}</Alert>}
      {view.blockers.length > 0 && (
        <ul className="settings-note" data-testid="voice-booking-blockers">
          {view.blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      <Switch
        name="enabled"
        label={t('Агент принимает брони по телефону')}
        hint={view.needsApproval ? t('Первую неделю бронь ждёт подтверждения администратора.') : undefined}
        defaultChecked={view.enabled}
        disabled={locked || (!view.enabled && !view.canEnable)}
      />
      <Field
        label={t('Броней за один звонок')}
        controlId="voice-booking-limit"
        hint={t('От 1 до 20. Больше агент не оформит, остальное уточнит администратор.')}
      >
        <Input
          name="maxPerCall"
          type="number"
          inputMode="numeric"
          min={1}
          max={20}
          defaultValue={view.maxPerCall}
          disabled={locked}
          data-testid="voice-booking-limit"
        />
      </Field>
      {editable && view.hasAgent && (
        <div>
          <Button type="submit" disabled={pending} aria-busy={pending} data-testid="voice-booking-save">
            {pending ? t('Сохраняю…') : t('Сохранить')}
          </Button>
        </div>
      )}
    </form>
  );
}
