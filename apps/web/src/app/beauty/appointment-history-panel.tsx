'use client';
import { useState, useTransition } from 'react';
import { Alert, Button } from '../../components/ui';
import { AppointmentHistory } from '../../components/beauty/appointment-history';
import type { BeautyAppointmentHistoryResponse } from '../../lib/api';
import { loadAppointmentHistory } from './appointment-history-actions';
import { useT } from '../../i18n/locale-provider';

export function AppointmentHistoryPanel({
  appointmentId,
  scopeKey,
}: {
  appointmentId: string;
  scopeKey: string;
}) {
  const [history, setHistory] = useState<BeautyAppointmentHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const t = useT();
  return (
    <section aria-label={t('История изменений записи')}>
      <Button
        type="button"
        tone="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const result = await loadAppointmentHistory(appointmentId, scopeKey);
            setHistory(result.history ?? null);
            setError(result.error ?? null);
          })
        }
      >
        {pending ? t('Загружаем историю…') : history ? t('Обновить историю') : t('История изменений')}
      </Button>
      {error && <Alert>{error}</Alert>}
      {history && <AppointmentHistory history={history} />}
    </section>
  );
}
