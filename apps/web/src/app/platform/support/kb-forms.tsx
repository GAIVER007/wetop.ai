'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Alert, Button, Field, Input, Notice, Row, Select, Stack, Textarea } from '../../../components/ui';
import { useConfirm } from '../../../components/use-confirm';
import { KB_CATEGORIES, KB_VISIBILITIES, kbActions, kbHref } from '../../../lib/support-kb';
import {
  kbDraftAction,
  kbPublishAction,
  kbSaveAction,
  kbStatusAction,
  type KbDraftResult,
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

export function KbEntryEditor({ entry }: { entry: KbEditable }) {
  const router = useRouter();
  const [values, setValues] = useState({
    title: entry.title,
    category: entry.category,
    visibility: entry.visibility,
    content: entry.content,
  });
  const [result, setResult] = useState<KbSimpleResult | null>(null);
  const [pending, start] = useTransition();
  const { ask, dialog } = useConfirm();
  const set = (name: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((prev) => ({ ...prev, [name]: e.target.value }));

  const save = () =>
    start(async () => {
      const saved = await kbSaveAction(entry.id, values);
      setResult({ error: saved.error, message: saved.message });
      if (saved.createdId) router.replace(kbHref({ id: saved.createdId }));
    });

  const publish = async () => {
    if (!entry.id) return;
    const ok = await ask({
      title: 'Опубликовать знание?',
      body: 'Помощник начнёт отвечать клиентам по этому тексту. Если в нём есть внутреннее или чужое — сначала поправьте.',
      confirmLabel: 'Опубликовать',
      cancelLabel: 'Не публиковать',
    });
    if (!ok) return;
    start(async () => setResult(await kbPublishAction(entry.id!)));
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
        <Row>
          <Button type="submit" disabled={pending} aria-busy={pending}>
            {pending ? 'Сохраняю…' : 'Сохранить'}
          </Button>
          {actions.includes('publish') && (
            <Button type="button" tone="secondary" onClick={publish} disabled={pending}>
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
