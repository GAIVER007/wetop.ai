'use client';
import Link from 'next/link';
import { useActionState, useId, useState } from 'react';
import { parseAgentInput, type AgentInputField } from '@pms/domain';
import { Alert, Button, Field, Input, Notice, Row, Select, Stack } from '../../../components/ui';
import type { AgentOptionsView } from '../../../lib/api';
import { createAgentAction, type CreateAgentResult } from './actions';

/**
 * Форма создания AI-продавца (SA2): название, Business, филиал. Занятый филиал виден и не выбирается — причина рядом.
 * Ключ повтора приходит от страницы: двойной щелчок отправляет ту же запись, а не вторую.
 */
export function AgentCreateForm({
  idempotencyKey,
  businesses,
}: {
  idempotencyKey: string;
  businesses: AgentOptionsView['businesses'];
}) {
  const [state, action, pending] = useActionState<CreateAgentResult | null, FormData>(createAgentAction, null);
  const errorId = useId();
  const [local, setLocal] = useState<{ field: AgentInputField; error: string } | null>(null);
  const firstFree = businesses.find((b) => b.locations.some((l) => l.free)) ?? businesses[0];
  const [businessId, setBusinessId] = useState(state?.values.businessId || firstFree?.id || '');
  const business = businesses.find((b) => b.id === businessId) ?? businesses[0];
  const freeLocation = business?.locations.find((l) => l.free);
  const kept = state?.values;
  const problem = local ?? (state?.error ? { field: state.field, error: state.error } : null);
  const invalid = (field: AgentInputField) =>
    problem?.field === field ? { 'aria-invalid': true, 'aria-describedby': errorId } : {};
  const fieldError = (field: AgentInputField) =>
    problem?.field === field ? <Alert id={errorId}>{problem.error}</Alert> : null;
  return (
    <form
      action={action}
      key={state?.attempt ?? 0}
      className="stack agent-create"
      data-testid="agent-create-form"
      noValidate
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        const parsed = parseAgentInput({
          name: String(data.get('name') ?? ''),
          businessId: String(data.get('businessId') ?? ''),
          locationId: String(data.get('locationId') ?? ''),
        });
        if (!parsed.ok) {
          event.preventDefault();
          const field = (['name', 'businessId', 'locationId'] as const).find((f) => parsed.errors[f])!;
          setLocal({ field, error: parsed.errors[field]! });
        } else setLocal(null);
      }}
    >
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      {problem && !problem.field && <Alert boxed data-testid="agent-create-error">{problem.error}</Alert>}
      <Field label="Название агента">
        <Input
          name="name"
          required
          maxLength={80}
          placeholder="AI-продавец Luxx"
          defaultValue={kept?.name ?? ''}
          data-testid="agent-name"
          {...invalid('name')}
        />
        {fieldError('name')}
      </Field>
      <Field label="Бизнес">
        <Select
          name="businessId"
          value={businessId}
          onChange={(event) => setBusinessId(event.target.value)}
          data-testid="agent-business"
          {...invalid('businessId')}
        >
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
        {fieldError('businessId')}
      </Field>
      <Field label="Филиал">
        <Select
          key={businessId}
          name="locationId"
          defaultValue={(kept?.businessId === businessId ? kept.locationId : '') || freeLocation?.id || ''}
          data-testid="agent-location"
          {...invalid('locationId')}
        >
          {business?.locations.map((l) => (
            <option key={l.id} value={l.id} disabled={!l.free}>
              {l.free ? l.name : `${l.name} — занят`}
            </option>
          ))}
        </Select>
        {fieldError('locationId')}
      </Field>
      {business?.locations.some((l) => !l.free) && (
        <Notice tone="muted" data-testid="agent-location-taken">
          Занятый филиал выбрать нельзя: для него AI-продавец уже создан.
        </Notice>
      )}
      <Stack gap="sm">
        <Row>
          <Button type="submit" disabled={pending} aria-busy={pending} data-testid="agent-create-submit">
            {pending ? 'Создаю…' : 'Создать и настроить'}
          </Button>
          <Link className="btn btn--secondary" href="/ai-agents">
            Отмена
          </Link>
        </Row>
      </Stack>
    </form>
  );
}
