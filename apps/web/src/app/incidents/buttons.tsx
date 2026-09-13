'use client';
import { useState, useTransition } from 'react';
import { Alert, Button, Notice, Row } from '../../components/ui';
import { guardTickAction, incidentAction, type IncidentActionResult } from './actions';

export function IncidentButtons({ id, canAcknowledge }: { id: string; canAcknowledge: boolean }) {
  const [result, setResult] = useState<IncidentActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <Row>
      {canAcknowledge && (
        <Button
          size="sm"
          type="button"
          data-testid="incident-acknowledge"
          disabled={pending}
          onClick={() => start(async () => setResult(await incidentAction('acknowledge', id)))}
          title="Я в курсе — сторож перестанет будить по этой неисправности"
        >
          Принято
        </Button>
      )}
      <Button
        size="sm"
        tone="secondary"
        type="button"
        data-testid="incident-resolve"
        disabled={pending}
        onClick={() => start(async () => setResult(await incidentAction('resolve', id)))}
        title="Закрыть вручную. Если проверка снова её увидит, откроется новая запись"
      >
        Решено
      </Button>
      {result?.error && <Alert>{result.error}</Alert>}
    </Row>
  );
}

export function GuardTickButton() {
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
        {pending ? 'Проверяю…' : 'Проверить сейчас'}
      </Button>
      {result?.message && <Notice>{result.message}</Notice>}
      {result?.error && <Alert>{result.error}</Alert>}
    </Row>
  );
}
