'use client';
import { useActionState } from 'react';
import { Alert, Button, Field, Notice, Row, Select, Textarea } from '../../../components/ui';
import type { SimpleResult } from '../../ai-seller/actions';
import { supportModelAction, supportPromptAction, type PromptFormResult } from './actions';

/**
 * Правила ИИ-помощника — текст его системного промпта (ADR-084): кто он, что делает, чего не делает, как отвечает.
 * Правит главный администратор; помощник отвечает по новым правилам со следующего сообщения. Отказ — словами API,
 * введённое остаётся в поле.
 */
export function SupportPromptForm({ initial, max }: { initial: string; max: number }) {
  const [state, action, pending] = useActionState<PromptFormResult | null, FormData>(
    supportPromptAction,
    null,
  );
  return (
    <form
      key={state?.attempt ?? 0}
      action={action}
      className="stack"
      data-testid="support-prompt-form"
    >
      <Field label="Правила помощника">
        <Textarea
          name="text"
          rows={18}
          maxLength={max}
          required
          defaultValue={state?.text ?? initial}
          data-testid="support-prompt-text"
        />
      </Field>
      {state?.error && <Alert data-testid="support-prompt-error">{state.error}</Alert>}
      {state?.message && <Notice data-testid="support-prompt-result">{state.message}</Notice>}
      <Row>
        <Button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          data-testid="support-prompt-save"
        >
          {pending ? 'Сохраняю…' : 'Сохранить правила'}
        </Button>
      </Row>
    </form>
  );
}

/** Модель помощника — только из списка разрешённых у бота, свободного поля нет */
export function SupportModelForm({
  models,
  current,
}: {
  models: string[];
  current: string | null;
}) {
  const [state, action, pending] = useActionState<SimpleResult | null, FormData>(
    supportModelAction,
    null,
  );
  return (
    <form
      key={state?.attempt ?? 0}
      action={action}
      className="stack stack--sm form-narrow"
      data-testid="support-model-form"
    >
      <Field label="Модель">
        <Select name="model" defaultValue={current ?? models[0] ?? ''}>
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
      </Field>
      {state?.error && <Alert data-testid="support-model-error">{state.error}</Alert>}
      {state?.message && <Notice data-testid="support-model-result">{state.message}</Notice>}
      <Row>
        <Button
          type="submit"
          tone="secondary"
          disabled={pending}
          aria-busy={pending}
          data-testid="support-model-save"
        >
          {pending ? 'Сохраняю…' : 'Сменить модель'}
        </Button>
      </Row>
    </form>
  );
}
