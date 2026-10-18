'use client';

import { useRef, useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Field, Input, Notice, Stack, Table } from '../../components/ui';
import { Overlay } from '../../components/overlay';
import type { BeautyCustomerImportPreview, BeautyCustomerImportStatus } from '../../lib/api';
import {
  applyBeautyCustomerImport,
  createBeautyCustomer,
  previewBeautyCustomerImport,
  type CustomerActionResult,
} from './actions';

const importStatus: Record<BeautyCustomerImportStatus, string> = {
  CREATE: 'Будет создан',
  ALREADY_EXISTS: 'Уже есть',
  CONFLICT: 'Конфликт',
  DUPLICATE_IN_FILE: 'Повтор в файле',
};

export function BeautyCustomerTools({
  canEdit,
  scopeKey,
  showCreate = true,
  importHistory,
}: {
  canEdit: boolean;
  scopeKey: string;
  showCreate?: boolean;
  importHistory?: ReactNode;
}) {
  const [mode, setMode] = useState<'create' | 'import' | null>(null);
  const [result, setResult] = useState<CustomerActionResult | null>(null);
  const [preview, setPreview] = useState<BeautyCustomerImportPreview | null>(null);
  const [draftScope, setDraftScope] = useState('');
  const [pending, startTransition] = useTransition();
  const importForm = useRef<HTMLFormElement>(null);
  const router = useRouter();

  if (!canEdit) return null;
  const open = (next: 'create' | 'import') => {
    setDraftScope(scopeKey);
    setMode(next);
    setResult(null);
    setPreview(null);
  };
  const close = () => {
    setMode(null);
    setResult(null);
    setPreview(null);
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
  const submitPreview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    startTransition(async () => {
      const next = await previewBeautyCustomerImport(new FormData(form));
      setResult(next);
      setPreview(next.preview ?? null);
    });
  };
  const applyImport = () => {
    if (!importForm.current) return;
    startTransition(async () => {
      const next = await applyBeautyCustomerImport(new FormData(importForm.current!));
      setResult(next);
      if (!next.error) {
        router.refresh();
      }
    });
  };
  return (
    <>
      <div className="beauty-customer-tools">
        {showCreate && <Button type="button" onClick={() => open('create')}>Добавить клиента</Button>}
        <Button type="button" tone="secondary" onClick={() => open('import')}>Импортировать клиентов</Button>
        <span className="muted">CSV или XLSX с колонками «Имя» и «Телефон», до 500 строк.</span>
      </div>

      <Overlay open={showCreate && mode === 'create'} onClose={close} title="Добавить клиента" trapFocus>
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
              <Input name="phone" type="tel" maxLength={32} autoComplete="tel" inputMode="tel" />
            </Field>
            {result?.error && <Alert>{result.error}</Alert>}
            {result?.message && <Notice>{result.message}</Notice>}
            <div className="form-actions">
              <Button type="button" tone="ghost" onClick={close}>Отмена</Button>
              <Button type="submit" disabled={pending} aria-busy={pending}>Добавить</Button>
            </div>
          </Stack>
        </form>
      </Overlay>

      <Overlay open={mode === 'import'} onClose={close} title="Импортировать клиентов" trapFocus size="lg">
        <Stack gap="sm">
          {importHistory && (
            <section aria-labelledby="beauty-customer-import-history-title">
              <h3 id="beauty-customer-import-history-title">Надёжный импорт CSV и история</h3>
              {importHistory}
            </section>
          )}
          <section aria-labelledby="beauty-customer-import-file-title">
            <h3 id="beauty-customer-import-file-title">Импорт CSV или XLSX до 500 строк</h3>
            <Notice tone="muted">
              Поддерживаются XLSX и CSV в UTF-8 или Windows-1251. В CSV разделитель может быть точкой с запятой,
              запятой или табуляцией.
              Сначала проверьте отчёт, затем подтвердите импорт.
            </Notice>
            <form ref={importForm} className="settings-form" onSubmit={submitPreview}>
              <input type="hidden" name="scopeKey" value={draftScope} />
              <Field label="CSV или XLSX" controlId="beauty-customer-import-file" required>
                <Input
                  id="beauty-customer-import-file"
                  name="file"
                  type="file"
                  accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  disabled={pending}
                  onChange={() => {
                    setPreview(null);
                    setResult(null);
                  }}
                />
              </Field>
              <Button type="submit" tone="secondary" disabled={pending} aria-busy={pending}>Проверить файл</Button>
            </form>
            {result?.error && <Alert>{result.error}</Alert>}
            {result?.message && <Notice>{result.message}</Notice>}
            {preview && (
              <>
                <p role="status">
                  Будет создано: {preview.totals.create}. Уже есть: {preview.totals.alreadyExists}.
                  Конфликтов: {preview.totals.conflicts}. Повторов в файле: {preview.totals.duplicatesInFile}.
                </p>
                <Table aria-label="Предпросмотр импорта клиентов">
                  <thead><tr><th>Строка</th><th>Имя</th><th>Телефон</th><th>Результат</th></tr></thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.line}>
                        <td data-label="Строка">{row.line}</td>
                        <td data-label="Имя">{row.name}</td>
                        <td data-label="Телефон">{row.phone}</td>
                        <td data-label="Результат">{importStatus[row.status]}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <div className="form-actions">
                  <Button type="button" tone="ghost" onClick={close}>Отмена</Button>
                  <Button
                    type="button"
                    onClick={applyImport}
                    disabled={pending || preview.totals.conflicts > 0 || !!result?.message}
                    aria-busy={pending}
                  >
                    Импортировать
                  </Button>
                </div>
              </>
            )}
          </section>
        </Stack>
      </Overlay>
    </>
  );
}
