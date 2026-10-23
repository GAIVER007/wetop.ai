'use client';

import { useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Field, Input, Notice, Stack } from '../../components/ui';
import { Overlay } from '../../components/overlay';
import { createBeautyCustomer, type CustomerActionResult } from './actions';
import { phoneOnInput } from '../../lib/phone';

export function BeautyCustomerTools({
  canEdit,
  scopeKey,
  showCreate = true,
  importHistory,
}: {
  canEdit: boolean;
  scopeKey: string;
  showCreate?: boolean;
  /**
   * Единственный импорт клиентов (решение владельца 20.10.2026): надёжный импорт CSV или Excel с историей и отменой.
   * Быстрый импорт до 500 строк убран: два поля файла в одном окне путали, какой из импортов сработал.
   */
  importHistory?: ReactNode;
}) {
  const [mode, setMode] = useState<'create' | 'import' | null>(null);
  const [result, setResult] = useState<CustomerActionResult | null>(null);
  const [draftScope, setDraftScope] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!canEdit) return null;
  const open = (next: 'create' | 'import') => {
    setDraftScope(scopeKey);
    setMode(next);
    setResult(null);
  };
  const close = () => {
    setMode(null);
    setResult(null);
    setDraftScope('');
  };
  const submitCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    startTransition(async () => {
      const next = await createBeautyCustomer(new FormData(form));
      setResult(next);
      if (!next.error) {
        form.reset();
        router.refresh();
      }
    });
  };
  return (
    <>
      {/* кнопки встают в панель списка рядом с «Скачать Excel» (аудит 21.10.2026 п.44), подсказка о файле в окне импорта */}
      {showCreate && <Button type="button" onClick={() => open('create')}>Добавить клиента</Button>}
      <Button type="button" tone="secondary" onClick={() => open('import')}>Импортировать клиентов</Button>

      {showCreate && <Overlay open={mode === 'create'} onClose={close} title="Добавить клиента" trapFocus>
        <form className="settings-form" onSubmit={submitCreate}>
          <Stack gap="sm">
            <input type="hidden" name="scopeKey" value={draftScope} />
            <Field label="Имя" controlId="beauty-customer-first-name" required>
              <Input name="firstName" maxLength={100} autoComplete="given-name" />
            </Field>
            <Field label="Фамилия" controlId="beauty-customer-last-name" required={false}>
              <Input name="lastName" maxLength={100} autoComplete="family-name" />
            </Field>
            <Field label="Телефон" controlId="beauty-customer-phone" required>
              <Input name="phone" type="tel" maxLength={32} autoComplete="tel" inputMode="tel" placeholder="+7 701 000 00 00" onInput={phoneOnInput} />
            </Field>
            {result?.error && <Alert>{result.error}</Alert>}
            {result?.message && <Notice>{result.message}</Notice>}
            <div className="form-actions">
              <Button type="button" tone="ghost" onClick={close}>Отмена</Button>
              <Button type="submit" disabled={pending} aria-busy={pending}>Добавить</Button>
            </div>
          </Stack>
        </form>
      </Overlay>}

      <Overlay open={mode === 'import'} onClose={close} title="Импортировать клиентов" trapFocus size="lg">
        <p className="muted">CSV или XLSX (Excel) с колонками «Имя» и «Телефон», до 50 000 строк.</p>
        {importHistory}
      </Overlay>
    </>
  );
}
