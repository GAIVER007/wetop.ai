'use client';
import { useActionState } from 'react';
import { EXTENSION_STATUSES } from '@pms/domain';
import { DateInput } from '../../components/date-field';
import { Alert, Button, Field, Grid, Input, Notice, Row, Select } from '../../components/ui';
import type { ExtensionChangeBody } from '../../lib/api';
import { changeAiSellerAction, type ExtensionFormResult } from './actions';

/**
 * Изменение расширения «ИИ-продавец» одной организации (Q-183): статус, последний день и заметка. Пробному нужен срок;
 * пустой срок у «оплачен» — бессрочно; «выключен» срок не читает. Проверяет API — слова отказа его.
 */
export function ExtensionForm({
  organizationId,
  organizationName,
  initial,
}: {
  organizationId: string;
  organizationName: string;
  initial: ExtensionChangeBody;
}) {
  const [state, action, pending] = useActionState<ExtensionFormResult | null, FormData>(
    changeAiSellerAction.bind(null, organizationId),
    null,
  );
  const values = state?.values ?? initial;
  return (
    <form
      key={state?.attempt ?? 0}
      action={action}
      className="stack"
      aria-label={`ИИ-продавец: ${organizationName}`}
      data-testid="platform-extension-form"
    >
      <Grid min={220}>
        <Field label="Статус">
          <Select name="status" defaultValue={values.status}>
            {(Object.keys(EXTENSION_STATUSES) as Array<keyof typeof EXTENSION_STATUSES>).map(
              (s) => (
                <option key={s} value={s}>
                  {EXTENSION_STATUSES[s]}
                </option>
              ),
            )}
          </Select>
        </Field>
        <Field label="Действует по (включительно)">
          <DateInput name="activeUntil" defaultValue={values.activeUntil} />
        </Field>
        <Field label="Заметка — номер счёта">
          <Input
            name="note"
            defaultValue={values.note}
            maxLength={300}
            placeholder="Счёт № 17 от 25.09.2026"
          />
        </Field>
      </Grid>
      <p className="settings-note">
        Пробному доступу нужен срок. У «оплачен» пустой срок — бессрочно, например у своей
        гостиницы. «Выключен» — раздел пропадёт из меню, ничего не удаляется. Каждое изменение
        пишется в журнал.
      </p>
      {state?.error && <Alert data-testid="platform-extension-error">{state.error}</Alert>}
      {state?.message && <Notice data-testid="platform-extension-result">{state.message}</Notice>}
      <Row>
        <Button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          data-testid="platform-extension-save"
        >
          {pending ? 'Сохраняю…' : 'Сохранить'}
        </Button>
      </Row>
    </form>
  );
}
