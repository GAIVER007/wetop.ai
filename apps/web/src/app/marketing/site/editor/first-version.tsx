'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert, Button, EmptyState, Notice, Stack } from '../../../../components/ui';
import { initialAction } from './actions';
import { RUN_STATE, runErrorText, useGenerationRun } from './run';

/**
 * Сайт есть, версий нет (MKT9 §119–§120): первая версия существующим потоком MKT6 (бриф → INITIAL → статус).
 * Стартового документа «вручную» нет: валидный каркас должен собирать сервер, а не браузер (§121 разрешает опустить)
 */
export function FirstVersion({ briefHash, readOnly }: { briefHash: string | null; readOnly: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const job = useGenerationRun((run) => {
    if (run.status === 'SUCCEEDED') router.refresh();
  });
  return (
    <Stack>
      {error && <Alert boxed>{error}</Alert>}
      {job.run && job.run.status !== 'FAILED' && <Notice data-testid="first-version-state">{RUN_STATE[job.run.status]}</Notice>}
      {job.run?.status === 'FAILED' && <Alert boxed>{runErrorText(job.run)}</Alert>}
    <EmptyState
      title="Сайт создан, но страниц ещё нет"
      data-testid="site-editor-empty"
      actions={
        <Button
          disabled={readOnly || !briefHash || job.active}
          data-testid="first-version-start"
          onClick={async () => {
            setError(null);
            const reply = await initialAction(briefHash!);
            if (reply.ok) job.start(reply.data.run);
            else setError(reply.message);
          }}
        >
          Создать первую версию с ИИ
        </Button>
      }
    >
      {briefHash
        ? 'ИИ соберёт первую версию из данных филиала. Её можно будет править здесь и опубликовать.'
        : 'Данные филиала сейчас недоступны: обновите страницу позже.'}
    </EmptyState>
    </Stack>
  );
}
