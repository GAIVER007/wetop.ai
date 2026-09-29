'use client';

import { useState, useTransition } from 'react';
import { Alert, Button, Notice, Row, Stack } from '../../../components/ui';
import { useConfirm } from '../../../components/use-confirm';
import type { SimpleResult } from '../../ai-seller/actions';
import { supportCloseAction, supportModeAction } from './actions';

/**
 * Действия оператора над открытым обращением (S1): «Забрать диалог» или «Вернуть ИИ» — по режиму, и «Закрыть
 * обращение» с подтверждением. Ответ — формой под перепиской (`DialogReplyForm`). У закрытого действий нет.
 */
export function SupportDialogActions({ id, mode }: { id: string; mode: string }) {
  const [result, setResult] = useState<SimpleResult | null>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<'mode' | 'close' | null>(null);
  const { ask, dialog } = useConfirm();

  const switchMode = (action: 'takeover' | 'release') => {
    setBusy('mode');
    start(async () => setResult(await supportModeAction(id, action)));
  };

  const close = async () => {
    const ok = await ask({
      title: 'Закрыть обращение?',
      body: 'Диалог уйдёт в «Закрытые» вместе с перепиской. Если человек напишет снова, откроется новое обращение.',
      confirmLabel: 'Закрыть обращение',
      cancelLabel: 'Оставить открытым',
      tone: 'secondary',
    });
    if (!ok) return;
    setBusy('close');
    start(async () => setResult(await supportCloseAction(id)));
  };

  const taken = mode === 'owner_takeover';
  return (
    <Stack gap="sm">
      <Row className="support-dialog__actions">
        {taken ? (
          <Button
            type="button"
            tone="secondary"
            onClick={() => switchMode('release')}
            disabled={pending}
            aria-busy={pending && busy === 'mode'}
            data-testid="dialog-release"
          >
            {pending && busy === 'mode' ? 'Возвращаю…' : 'Вернуть ИИ'}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => switchMode('takeover')}
            disabled={pending}
            aria-busy={pending && busy === 'mode'}
            data-testid="dialog-takeover"
          >
            {pending && busy === 'mode' ? 'Забираю…' : 'Забрать диалог'}
          </Button>
        )}
        <Button
          type="button"
          tone="ghost"
          onClick={close}
          disabled={pending}
          aria-busy={pending && busy === 'close'}
          data-testid="dialog-close"
        >
          {pending && busy === 'close' ? 'Закрываю…' : 'Закрыть обращение'}
        </Button>
      </Row>
      {result?.error && <Alert>{result.error}</Alert>}
      {result?.message && <Notice data-testid="dialog-mode-result">{result.message}</Notice>}
      {dialog}
    </Stack>
  );
}
