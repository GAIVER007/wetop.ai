'use client';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import type { BeautySchedule } from '../../lib/api';
import { saveBeautyEmployeeLocations } from '../../app/beauty/actions';
import { Alert, Button } from '../ui';
import { useT } from '../../i18n/locale-provider';

export function EmployeeLocationsForm({
  employeeId,
  locations,
}: {
  employeeId: string;
  locations: BeautySchedule['locations'];
}) {
  const router = useRouter();
  const t = useT();
  const [state, action, pending] = useActionState(
    async (
      previous: Awaited<ReturnType<typeof saveBeautyEmployeeLocations>> | null,
      form: FormData,
    ) => {
      const result = await saveBeautyEmployeeLocations(previous, form);
      if (!result.error) router.refresh();
      return result;
    },
    null,
  );

  return (
    <form action={action} className="beauty-form">
      <input type="hidden" name="id" value={employeeId} />
      <fieldset className="beauty-skills" disabled={pending}>
        <legend>{t('Где мастер работает')}</legend>
        {locations.map((location) => (
          <label key={location.id} className="beauty-check">
            <input
              type="checkbox"
              name="locationIds"
              value={location.id}
              defaultChecked={location.assigned}
            />
            {location.name}
          </label>
        ))}
      </fieldset>
      <p className="beauty-note">
        {t('Снятый филиал забирает и график мастера в нём. Если там остались будущие записи, филиал не снимется: сначала разберитесь с записями.')}
      </p>
      {state?.error && <Alert>{t(state.error)}</Alert>}
      {state?.message && <p role="status">{t(state.message)}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? t('Сохраняем…') : t('Сохранить филиалы')}
      </Button>
    </form>
  );
}
