'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Field, Select } from '../../../components/ui';
import { assignHousekeeperAction } from '../../hotel-staff/actions';
import { useT } from '../../../i18n/locale-provider';

/**
 * «Кто убирает» номер (решение владельца 22.10.2026, DATA_MODEL §4.1): стойка выбирает сотрудника гостиницы, и номер
 * появляется у него в «Моей работе» в «Моих уборках». Сотрудников нет: подсказка, где их добавить.
 */
export function HousekeeperPicker({
  code,
  current,
  employees,
}: {
  code: string;
  current: { id: string; name: string } | null;
  employees: ReadonlyArray<{ id: string; name: string; active: boolean }>;
}) {
  const t = useT();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const options = employees.filter((e) => e.active || e.id === current?.id);
  if (!options.length)
    return (
      <p className="hint" data-testid="hk-assignee-empty">
        {t('Сотрудников гостиницы пока нет: пригласите горничную в разделе «Персонал → Сотрудники» с доступом «Личный кабинет».')}
      </p>
    );
  return (
    <div className="hk-assign" data-testid="hk-assignee">
      <Field label={t('Кто убирает')}>
        <Select
          name="housekeepingAssignee"
          value={current?.id ?? ''}
          disabled={pending}
          onChange={(event) => {
            const next = event.target.value || null;
            start(async () => {
              setError(null);
              const result = await assignHousekeeperAction(code, next);
              if (result.error) setError(result.error);
              else router.refresh();
            });
          }}
        >
          <option value="">{t('Не назначено')}</option>
          {options.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </Select>
      </Field>
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
