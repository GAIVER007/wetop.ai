'use client';
import { useState } from 'react';
import { Button } from '../../components/ui';
import { ConfirmDialog } from '../../components/confirm-dialog';

export function BarIntentRecovery({ disabled, onNewIntent }: { disabled: boolean; onNewIntent: () => void }) {
  const [open, setOpen] = useState(false);
  return <>
    <p role="status">Результат требует проверки. Повтор использует исходные параметры.</p>
    <Button type="button" tone="ghost" size="xs" disabled={disabled} onClick={() => setOpen(true)}>Новая отдельная операция</Button>
    <ConfirmDialog open={open} title="Начать отдельную операцию?" confirmLabel="Начать новую операцию" pending={disabled}
      onCancel={() => setOpen(false)} onConfirm={() => { onNewIntent(); setOpen(false); }}>
      Предыдущая операция могла выполниться. Сначала проверьте кассу и склад. Новая отдельная операция может повторно изменить их.
    </ConfirmDialog>
  </>;
}
