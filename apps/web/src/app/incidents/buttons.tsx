'use client';
import { useState, useTransition } from 'react';
import { Alert, Button, Notice, Row } from '../../components/ui';
import { useT } from '../../i18n/locale-provider';
import { guardTickAction, incidentAction, type IncidentActionResult } from './actions';

export function IncidentButtons({ id, canAcknowledge }: { id: string; canAcknowledge: boolean }) {
  const t = useT();
  const [result, setResult] = useState<IncidentActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <Row>
      {canAcknowledge && (
        <Button
          size="sm"
          tone="secondary"
          type="button"
          data-testid="incident-acknowledge"
          disabled={pending}
          onClick={() => start(async () => setResult(await incidentAction('acknowledge', id)))}
          title={t('Я в курсе — сторож перестанет будить по этой неисправности')}
        >
          {pending ? t('Сохраняю…') : t('Взять в работу')}
        </Button>
      )}
      <Button
        size="sm"
        tone="ghost"
        type="button"
        data-testid="incident-resolve"
        disabled={pending}
        onClick={() => start(async () => setResult(await incidentAction('resolve', id)))}
        title={t('Закрыть вручную. Если проверка снова её увидит, откроется новая запись')}
      >
        {pending ? t('Сохраняю…') : t('Закрыть')}
      </Button>
      {result?.error && <Alert>{result.error}</Alert>}
    </Row>
  );
}

export function GuardTickButton() {
  const t = useT();
  const [result, setResult] = useState<IncidentActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <Row>
      <Button
        tone="secondary"
        type="button"
        data-testid="guard-tick"
        disabled={pending}
        onClick={() => start(async () => setResult(await guardTickAction()))}
      >
        {pending ? t('Проверяю…') : t('Проверить сейчас')}
      </Button>
      {result?.message && <Notice>{result.message}</Notice>}
      {result?.error && <Alert>{result.error}</Alert>}
    </Row>
  );
}
