'use client';
import { useActionState, useTransition } from 'react';
import { EXTENSION_STATUSES } from '@pms/domain';
import { DateInput } from '../../components/date-field';
import { useConfirm } from '../../components/use-confirm';
import { Alert, Button, Field, Grid, Input, Notice, Row, Select } from '../../components/ui';
import type { ExtensionChangeBody } from '../../lib/api';
import {
  archiveOrganizationAction,
  changeAiSellerAction,
  changeStatusAction,
  renameOrganizationAction,
  restoreOrganizationAction,
  type ExtensionFormResult,
  type OrganizationActionResult,
  type StatusFormResult,
} from './actions';

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

/**
 * Подписка организации (Q-141 — А, ADR-102): клиент оплатил счёт по реквизитам — главный администратор жмёт
 * «Оплата получена», и организация снова может вносить изменения. «Только чтение» — обратно. Заметка — номер счёта.
 */
export function StatusForm({
  organizationId,
  organizationName,
  status,
}: {
  organizationId: string;
  organizationName: string;
  status: string;
}) {
  const [state, action, pending] = useActionState<StatusFormResult | null, FormData>(
    changeStatusAction.bind(null, organizationId),
    null,
  );
  return (
    <form
      key={state?.attempt ?? 0}
      action={action}
      className="stack"
      aria-label={`Подписка: ${organizationName}`}
      data-testid="platform-status-form"
    >
      <Field label="Заметка — номер счёта">
        <Input name="note" maxLength={300} placeholder="Счёт № 17 от 25.09.2026, WETOP Core" />
      </Field>
      <p className="settings-note">
        WETOP Core: 49 900 ₸ в месяц за каждый филиал до 100 номеров и коек. Доступ включается
        вручную после проверки оплаты. Эта кнопка меняет доступ и пишет заметку в журнал, но не
        создаёт платёж или оплаченный период. Автоматического списания нет. Подключение ИИ-продавца
        учитывается отдельно.
      </p>
      {state?.error && <Alert data-testid="platform-status-error">{state.error}</Alert>}
      {state?.message && <Notice data-testid="platform-status-result">{state.message}</Notice>}
      <Row>
        <Button
          type="submit"
          name="status"
          value="ACTIVE"
          disabled={pending || status === 'ACTIVE'}
          aria-busy={pending}
          data-testid="platform-status-active"
        >
          {pending ? 'Сохраняю…' : 'Оплата получена'}
        </Button>
        <Button
          type="submit"
          name="status"
          value="READ_ONLY"
          tone="secondary"
          disabled={pending || status === 'READ_ONLY'}
          data-testid="platform-status-readonly"
        >
          Только чтение
        </Button>
      </Row>
    </form>
  );
}

/** Название организации (ORG1, ADR-154): сжимает пробелы и проверяет API, отказ его словами */
export function RenameForm({
  organizationId,
  organizationName,
}: {
  organizationId: string;
  organizationName: string;
}) {
  const [state, action, pending] = useActionState<OrganizationActionResult | null, FormData>(
    renameOrganizationAction.bind(null, organizationId),
    null,
  );
  return (
    <form
      action={action}
      className="stack"
      aria-label="Название организации"
      data-testid="platform-rename-form"
    >
      <Field label="Название">
        <Input
          key={`${organizationName}-${state?.attempt ?? 0}`}
          name="name"
          defaultValue={organizationName}
          maxLength={200}
          required
        />
      </Field>
      {state?.error && <Alert data-testid="platform-rename-error">{state.error}</Alert>}
      {state?.message && <Notice data-testid="platform-rename-result">{state.message}</Notice>}
      <Row>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? 'Сохраняю…' : 'Сохранить название'}
        </Button>
      </Row>
    </form>
  );
}

/**
 * Архив вместо удаления (ORG1, ADR-154, Q-282): люди организации не входят, данные целы, вернуть можно. Перед архивом
 * спрашиваем окном стойки, возврат без вопроса. Свою организацию в архив убрать нельзя.
 */
export function ArchiveForm({
  organizationId,
  organizationName,
  archived,
  own,
}: {
  organizationId: string;
  organizationName: string;
  archived: boolean;
  own: boolean;
}) {
  const [state, action, pending] = useActionState<OrganizationActionResult | null, FormData>(
    (archived ? restoreOrganizationAction : archiveOrganizationAction).bind(null, organizationId),
    null,
  );
  const { ask, dialog } = useConfirm();
  const [, startTransition] = useTransition();
  async function submit() {
    if (!archived) {
      const ok = await ask({
        title: `Убрать «${organizationName}» в архив?`,
        body: 'Люди организации перестанут входить в платформу. Данные сохранятся, организация останется в списке архивных. Вернуть её можно в любой момент.',
        confirmLabel: 'Убрать в архив',
      });
      if (!ok) return;
    }
    startTransition(() => action(new FormData()));
  }
  return (
    <div className="stack" role="group" aria-label="Архив" data-testid="platform-archive-form">
      {own && (
        <p className="settings-note">
          Свою организацию в архив убрать нельзя: вы потеряли бы доступ к платформе.
        </p>
      )}
      {archived && (
        <p className="settings-note">
          Организация в архиве: люди не входят, данные сохранены. Возврат вернёт прежнее состояние, а
          если его не удалось определить, организация станет «только чтение».
        </p>
      )}
      {state?.error && <Alert data-testid="platform-archive-error">{state.error}</Alert>}
      {state?.message && <Notice data-testid="platform-archive-result">{state.message}</Notice>}
      <Row>
        <Button
          type="button"
          tone={archived ? 'primary' : 'secondary'}
          disabled={pending || own}
          aria-busy={pending}
          data-testid={archived ? 'platform-restore' : 'platform-archive'}
          onClick={submit}
        >
          {pending ? 'Выполняю…' : archived ? 'Вернуть из архива' : 'Убрать в архив'}
        </Button>
      </Row>
      {dialog}
    </div>
  );
}
