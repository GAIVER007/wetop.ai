'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Alert, Button, Field, Input, Notice, Row, Select, Stack, Textarea } from '../../../components/ui';
import { useConfirm } from '../../../components/use-confirm';
import { KB_CATEGORIES, KB_VISIBILITIES, kbActions, kbHref } from '../../../lib/support-kb';
import {
  kbDraftAction,
  kbPublishAction,
  kbSaveAction,
  kbStatusAction,
  type KbDraftResult,
  type KbSaveResult,
  type KbSimpleResult,
} from './kb-actions';

/**
 * Запись базы знаний (S3): поля, «Сохранить» и переходы состояния в одном месте — один общий результат под кнопками.
 * Публикует главный администратор (сервер ставит его имя сам), с вопросом перед публикацией. Ввод при отказе остаётся.
 */
export interface KbEditable {
  id: string | null;
  title: string;
  category: string;
  visibility: string;
  content: string;
  status: string | null;
}

export interface KbEditorValues {
  title: string;
  category: string;
  visibility: string;
  content: string;
}

export const kbEditorValues = (entry: KbEditable): KbEditorValues => ({
  title: entry.title,
  category: entry.category,
  visibility: entry.visibility,
  content: entry.content,
});

const kbValuesEqual = (left: KbEditorValues, right: KbEditorValues) =>
  left.title === right.title &&
  left.category === right.category &&
  left.visibility === right.visibility &&
  left.content === right.content;

export function kbPublishBlockReason({
  documentId,
  savedDocumentId,
  values,
  savedValues,
  busy,
}: {
  documentId: string | null;
  savedDocumentId: string | null;
  values: KbEditorValues;
  savedValues: KbEditorValues;
  busy: boolean;
}): string | null {
  if (busy) return 'Дождитесь завершения операции.';
  if (!documentId || documentId !== savedDocumentId) return 'Документ изменился. Дождитесь загрузки.';
  if (!kbValuesEqual(values, savedValues)) return 'Сначала сохраните изменения.';
  return null;
}

export function kbSaveCompletion(
  saved: KbSaveResult,
  submittedValues: KbEditorValues,
  currentValues: KbEditorValues,
): { result: KbSimpleResult; savedValues: KbEditorValues | null } {
  if (saved.error) {
    return { result: { error: saved.error, message: null }, savedValues: null };
  }
  return {
    result: {
      error: null,
      message: kbValuesEqual(submittedValues, currentValues)
        ? saved.message
        : 'Сохранена отправленная версия. Сначала сохраните новые изменения.',
    },
    savedValues: submittedValues,
  };
}

export function KbEntryEditor({ entry }: { entry: KbEditable }) {
  return <KbEntryEditorForm key={entry.id ?? 'new'} entry={entry} />;
}

function KbEntryEditorForm({ entry }: { entry: KbEditable }) {
  const router = useRouter();
  const initialValues = kbEditorValues(entry);
  const [values, setValues] = useState(initialValues);
  const [savedValues, setSavedValues] = useState(initialValues);
  const [result, setResult] = useState<KbSimpleResult | null>(null);
  const [pending, start] = useTransition();
  const { ask, dialog } = useConfirm();
  const valuesRef = useRef(values);
  const savedValuesRef = useRef(savedValues);
  const busyRef = useRef(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  const set = (name: keyof KbEditorValues) => (e: { target: { value: string } }) => {
    const value = e.target.value;
    const next = { ...valuesRef.current, [name]: value };
    valuesRef.current = next;
    setValues(next);
    setResult(null);
  };

  const dirty = !kbValuesEqual(values, savedValues);

  const save = () => {
    if (busyRef.current) return;
    const documentId = entry.id;
    const submittedValues = { ...valuesRef.current };
    busyRef.current = true;
    start(async () => {
      try {
        const saved = await kbSaveAction(documentId, submittedValues);
        if (!aliveRef.current) return;
        const completion = kbSaveCompletion(saved, submittedValues, valuesRef.current);
        setResult(completion.result);
        if (completion.savedValues) {
          savedValuesRef.current = completion.savedValues;
          setSavedValues(completion.savedValues);
        }
        if (saved.createdId) router.replace(kbHref({ id: saved.createdId }));
      } finally {
        busyRef.current = false;
      }
    });
  };

  const publish = async () => {
    if (!entry.id) return;
    const blockReason = kbPublishBlockReason({
      documentId: entry.id,
      savedDocumentId: entry.id,
      values: valuesRef.current,
      savedValues: savedValuesRef.current,
      busy: busyRef.current || pending,
    });
    if (blockReason) {
      setResult({ error: blockReason, message: null });
      return;
    }
    const ok = await ask({
      title: 'Опубликовать знание?',
      body: 'Помощник начнёт отвечать клиентам по этому тексту. Если в нём есть внутреннее или чужое — сначала поправьте.',
      confirmLabel: 'Опубликовать',
      cancelLabel: 'Не публиковать',
    });
    if (!ok || !aliveRef.current) return;
    const confirmedBlockReason = kbPublishBlockReason({
      documentId: entry.id,
      savedDocumentId: entry.id,
      values: valuesRef.current,
      savedValues: savedValuesRef.current,
      busy: busyRef.current,
    });
    if (confirmedBlockReason) {
      setResult({ error: confirmedBlockReason, message: null });
      return;
    }
    busyRef.current = true;
    start(async () => {
      try {
        const published = await kbPublishAction(entry.id!);
        if (aliveRef.current) setResult(published.error
          ? { error: `Сохранено, но не опубликовано: ${published.error}`, message: null }
          : published);
      } finally {
        busyRef.current = false;
      }
    });
  };

  const move = (status: string) =>
    start(async () => setResult(await kbStatusAction(entry.id!, status)));

  const actions = entry.id ? kbActions(entry.status) : [];
  return (
    <Stack>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Название">
          <Input name="title" value={values.title} onChange={set('title')} maxLength={200} />
        </Field>
        <Row>
          <Field label="Категория">
            <Select name="category" value={values.category} onChange={set('category')}>
              {KB_CATEGORIES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Видимость">
            <Select name="visibility" value={values.visibility} onChange={set('visibility')}>
              {KB_VISIBILITIES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </Row>
        <Field label="Текст знания">
          <Textarea name="content" rows={14} value={values.content} onChange={set('content')} maxLength={20_000} />
        </Field>
        {result?.error && <Alert data-testid="kb-error">{result.error}</Alert>}
        {result?.message && <Notice data-testid="kb-result">{result.message}</Notice>}
        {actions.includes('publish') && dirty && (
          <Notice tone="muted" data-testid="kb-save-before-publish">
            Сначала сохраните изменения.
          </Notice>
        )}
        <Row>
          <Button type="submit" disabled={pending} aria-busy={pending}>
            {pending ? 'Сохраняю…' : 'Сохранить'}
          </Button>
          {actions.includes('publish') && (
            <Button type="button" tone="secondary" onClick={publish} disabled={pending || dirty}>
              Опубликовать
            </Button>
          )}
          {actions.includes('outdated') && (
            <Button type="button" tone="secondary" onClick={() => move('OUTDATED')} disabled={pending}>
              Пометить устаревшим
            </Button>
          )}
          {actions.includes('draft') && (
            <Button type="button" tone="secondary" onClick={() => move('DRAFT')} disabled={pending}>
              Вернуть в черновик
            </Button>
          )}
          {actions.includes('archive') && (
            <Button type="button" tone="ghost" onClick={() => move('ARCHIVED')} disabled={pending}>
              В архив
            </Button>
          )}
        </Row>
      </form>
      {dialog}
    </Stack>
  );
}

/** «Создать знание из обращения» — только у закрытого; создаётся пустой черновик, переписка не копируется */
export function KbDraftButton({ conversationId }: { conversationId: string }) {
  const [result, setResult] = useState<KbDraftResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <Stack gap="sm">
      <Row>
        <Button
          type="button"
          tone="secondary"
          disabled={pending || result?.href != null}
          aria-busy={pending}
          onClick={() => start(async () => setResult(await kbDraftAction(conversationId)))}
        >
          {pending ? 'Создаю…' : 'Создать знание из обращения'}
        </Button>
      </Row>
      {result?.error && <Alert>{result.error}</Alert>}
      {result?.message && (
        <Notice data-testid="kb-draft-result">
          {result.message}{' '}
          {result.href && (
            <Link href={result.href} prefetch={false}>
              Открыть черновик
            </Link>
          )}
        </Notice>
      )}
    </Stack>
  );
}
