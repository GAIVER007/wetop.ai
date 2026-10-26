'use client';

import {
  BEAUTY_ACTIONS,
  BEAUTY_ACTION_LABELS,
  BEAUTY_SECTIONS,
  BEAUTY_SECTION_LABELS,
  type BeautyAction,
  type BeautyPermission,
  type BeautyPermissionScope,
  type BeautySection,
} from '@pms/domain';
import { useMemo, useState, type FormEvent } from 'react';
import { useConfirm } from '../../../components/use-confirm';
import { Alert, Button, Field, Input, Notice, Select } from '../../../components/ui';
import type {
  BeautyPositionAssignmentRow,
  BeautyPositionRow,
  BeautyPositionsWorkspace,
} from '../../../lib/api';
import {
  archiveBeautyPosition,
  assignBeautyPosition,
  createBeautyPosition,
  revokeBeautyPosition,
  updateBeautyPosition,
  type PositionActionState,
} from './position-actions';
import { msg, type Translate } from '../../../i18n';
import { useT } from '../../../i18n/locale-provider';
import './positions.css';

const OWN_SECTIONS = new Set<BeautySection>(['journal', 'appointments', 'payroll', 'reviews']);
const CRUD_ACTIONS = BEAUTY_ACTIONS.filter((action) => action !== 'refund');

export const POSITION_TEMPLATES = {
  master: {
    name: msg('Мастер'),
    permissions: [
      { section: 'journal', action: 'view', scope: 'OWN' },
      { section: 'appointments', action: 'view', scope: 'OWN' },
      { section: 'payroll', action: 'view', scope: 'OWN' },
      { section: 'reviews', action: 'view', scope: 'OWN' },
    ] satisfies BeautyPermission[],
  },
  administrator: {
    name: msg('Администратор'),
    permissions: [
      { section: 'journal', action: 'view', scope: 'BUSINESS' },
      { section: 'journal', action: 'create', scope: 'BUSINESS' },
      { section: 'journal', action: 'update', scope: 'BUSINESS' },
      { section: 'appointments', action: 'view', scope: 'BUSINESS' },
      { section: 'appointments', action: 'create', scope: 'BUSINESS' },
      { section: 'appointments', action: 'update', scope: 'BUSINESS' },
      { section: 'appointments', action: 'delete', scope: 'BUSINESS' },
      { section: 'customers', action: 'view', scope: 'BUSINESS' },
      { section: 'customers', action: 'create', scope: 'BUSINESS' },
      { section: 'customers', action: 'update', scope: 'BUSINESS' },
      { section: 'services', action: 'view', scope: 'BUSINESS' },
      // касса: принять оплату и провести расход; возврат денег и склад по отдельному решению владельца салона
      // (запуск первых салонов 25.10.2026: шаблон без возврата и склада)
      { section: 'finance', action: 'view', scope: 'BUSINESS' },
      { section: 'finance', action: 'create', scope: 'BUSINESS' },
      { section: 'reviews', action: 'view', scope: 'BUSINESS' },
    ] satisfies BeautyPermission[],
  },
} as const;

type Draft = {
  id: string | null;
  name: string;
  revision: number;
  permissions: BeautyPermission[];
};

const draftOf = (position: BeautyPositionRow): Draft => ({
  id: position.id,
  name: position.name,
  revision: position.revision,
  permissions: position.permissions.map((permission) => ({ ...permission })),
});

const templateDraft = (template: keyof typeof POSITION_TEMPLATES, t: Translate): Draft => ({
  id: null,
  name: t(POSITION_TEMPLATES[template].name),
  revision: 0,
  permissions: POSITION_TEMPLATES[template].permissions.map((permission) => ({ ...permission })),
});

const permissionOf = (
  draft: Draft,
  section: BeautySection,
  action: BeautyAction,
) => draft.permissions.find((permission) => permission.section === section && permission.action === action);

const memberLabel = (member: BeautyPositionsWorkspace['members'][number]) =>
  member.name?.trim() ? `${member.name} (${member.email})` : member.email;

export function PositionsBoard({
  initial,
  scopeKey,
  canEdit,
  canCreate = canEdit,
  canUpdate = canEdit,
  canArchive = canEdit,
}: {
  initial: BeautyPositionsWorkspace;
  scopeKey: string;
  canEdit: boolean;
  canCreate?: boolean;
  canUpdate?: boolean;
  canArchive?: boolean;
}) {
  const t = useT();
  const [workspace, setWorkspace] = useState(initial);
  const firstPosition = initial.positions.find((position) => !position.archivedAt) ?? initial.positions[0];
  const [draft, setDraft] = useState<Draft>(() =>
    firstPosition ? draftOf(firstPosition) : templateDraft('administrator', t),
  );
  const [state, setState] = useState<PositionActionState>(null);
  const [busy, setBusy] = useState(false);
  const [assignmentUserId, setAssignmentUserId] = useState(initial.members[0]?.userId ?? '');
  const [assignmentPositionId, setAssignmentPositionId] = useState(
    initial.positions.find((position) => !position.archivedAt)?.id ?? '',
  );
  const [assignmentLocationId, setAssignmentLocationId] = useState('');
  const { ask, dialog } = useConfirm();
  const canManageAny = canCreate || canUpdate || canArchive;
  const archivedDraft = !!workspace.positions.find((item) => item.id === draft.id)?.archivedAt;
  const canEditDraft = !archivedDraft && (draft.id ? canUpdate : canCreate);

  const selectedMember = workspace.members.find((member) => member.userId === assignmentUserId);
  const allowedLocations = useMemo(
    () => workspace.locations.filter((location) => selectedMember?.locationIds.includes(location.id)),
    [selectedMember, workspace.locations],
  );
  const currentAssignment = workspace.assignments.find(
    (assignment) =>
      assignment.userId === assignmentUserId &&
      assignment.locationId === (assignmentLocationId || null),
  );

  const applyResult = (result: PositionActionState) => {
    setState(result);
    if (result?.workspace) {
      setWorkspace(result.workspace);
      setDraft((current) => {
        const exact = current.id
          ? result.workspace?.positions.find((position) => position.id === current.id)
          : result.workspace?.positions.find(
              (position) => !position.archivedAt && position.name === current.name,
            );
        return exact ? draftOf(exact) : current;
      });
    }
  };

  const run = async (work: () => Promise<PositionActionState>) => {
    setBusy(true);
    try {
      applyResult(await work());
    } finally {
      setBusy(false);
    }
  };

  const positionForm = () => {
    const form = new FormData();
    form.set('scopeKey', scopeKey);
    form.set('positionName', draft.name);
    form.set('permissions', JSON.stringify(draft.permissions));
    if (draft.id) {
      form.set('positionId', draft.id);
      form.set('expectedRevision', String(draft.revision));
    }
    return form;
  };

  const savePosition = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(() =>
      draft.id
        ? updateBeautyPosition(state, positionForm())
        : createBeautyPosition(state, positionForm()),
    );
  };

  const archivePosition = async () => {
    if (!draft.id || !(await ask({
      title: t('Архивировать должность «{name}»?', { name: draft.name }),
      body: t('Должность исчезнет из новых назначений. Активные назначения нужно снять заранее.'),
      confirmLabel: t('Архивировать должность'),
    }))) return;
    const form = positionForm();
    await run(() => archiveBeautyPosition(state, form));
  };

  const choosePosition = (id: string) => {
    const position = workspace.positions.find((item) => item.id === id);
    if (position) {
      setDraft(draftOf(position));
      setState(null);
    }
  };

  const setPermission = (
    section: BeautySection,
    action: BeautyAction,
    enabled: boolean,
    scope?: BeautyPermissionScope,
  ) => {
    setState(null);
    setDraft((current) => {
      const without = current.permissions.filter(
        (permission) => permission.section !== section || permission.action !== action,
      );
      return {
        ...current,
        permissions: enabled
          ? [...without, { section, action, scope: scope ?? 'BUSINESS' }]
          : without,
      };
    });
  };

  const assign = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData();
    form.set('scopeKey', scopeKey);
    form.set('assignmentUserId', assignmentUserId);
    form.set('assignmentPositionId', assignmentPositionId);
    form.set('assignmentLocationId', assignmentLocationId);
    form.set('expectedRevision', String(currentAssignment?.revision ?? 0));
    void run(() => assignBeautyPosition(state, form));
  };

  const revoke = async (assignment: BeautyPositionAssignmentRow) => {
    const member = workspace.members.find((item) => item.userId === assignment.userId);
    if (!(await ask({
      title: member ? t('Отозвать должность у {name}?', { name: memberLabel(member) }) : t('Отозвать должность у сотрудника?'),
      body: t('Назначение останется в истории. Старая роль не вернёт доступ к салону.'),
      confirmLabel: t('Отозвать доступ'),
    }))) return;
    const form = new FormData();
    form.set('scopeKey', scopeKey);
    form.set('assignmentId', assignment.id);
    form.set('expectedRevision', String(assignment.revision));
    await run(() => revokeBeautyPosition(state, form));
  };

  const activePositions = workspace.positions.filter((position) => !position.archivedAt);

  return (
    <div className="beauty-positions">
      <section className="panel beauty-positions__editor" aria-labelledby="beauty-position-heading">
        <div className="beauty-positions__heading">
          <div>
            <h2 id="beauty-position-heading">{t('Должности салона')}</h2>
            <p className="muted">{t('Выберите должность, проверьте права и сохраните изменения.')}</p>
          </div>
          {!canManageAny && <span className="beauty-positions__readonly">{t('Только просмотр')}</span>}
        </div>

        <div className="beauty-positions__picker">
          <Field label={t('Выбрать должность')} controlId="beauty-position-select">
            <Select
              id="beauty-position-select"
              value={draft.id ?? ''}
              onChange={(event) => choosePosition(event.target.value)}
            >
              {!draft.id && <option value="">{t('Новая должность, проверьте перед созданием')}</option>}
              {workspace.positions.map((position) => (
                <option key={position.id} value={position.id}>
                  {position.name}{position.archivedAt ? t(' (архив)') : ''}
                </option>
              ))}
            </Select>
          </Field>
          {canCreate && (
            <div className="beauty-positions__templates" aria-label={t('Шаблоны новой должности')}>
              <Button
                type="button"
                tone="secondary"
                onClick={() => {
                  setDraft(templateDraft('master', t));
                  setState(null);
                }}
              >
                {t('Новая должность мастера')}
              </Button>
              <Button
                type="button"
                tone="secondary"
                onClick={() => {
                  setDraft(templateDraft('administrator', t));
                  setState(null);
                }}
              >
                {t('Новая должность администратора')}
              </Button>
            </div>
          )}
        </div>

        <form onSubmit={savePosition} className="beauty-position-form">
          <Field label={t('Название должности')} controlId="beauty-position-name" required>
            <Input
              id="beauty-position-name"
              name="positionName"
              value={draft.name}
              maxLength={100}
              disabled={!canEditDraft || busy}
              onChange={(event) => {
                setDraft((current) => ({ ...current, name: event.target.value }));
                setState(null);
              }}
            />
          </Field>

          <div className="beauty-position-matrix" role="group" aria-label={t('Права должности')}>
            <div className="beauty-position-permission-row beauty-position-permission-row--head" aria-hidden="true">
              <span>{t('Раздел')}</span>
              {CRUD_ACTIONS.map((action) => <span key={action}>{t(BEAUTY_ACTION_LABELS[action])}</span>)}
            </div>
            {BEAUTY_SECTIONS.map((section) => (
              <div className="beauty-position-permission-row" key={section}>
                <strong>{t(BEAUTY_SECTION_LABELS[section])}</strong>
                {CRUD_ACTIONS.map((action) => {
                  const permission = permissionOf(draft, section, action);
                  const canOwn = action === 'view' && OWN_SECTIONS.has(section);
                  return (
                    <div className="beauty-position-permission" key={action}>
                      <label>
                        <span className="beauty-position-permission__mobile">{t(BEAUTY_ACTION_LABELS[action])}</span>
                        <input
                          type="checkbox"
                          name={`permission:${section}:${action}`}
                          checked={!!permission}
                          disabled={!canEditDraft || busy}
                          onChange={(event) => setPermission(section, action, event.target.checked, canOwn ? 'OWN' : 'BUSINESS')}
                          aria-label={`${t(BEAUTY_SECTION_LABELS[section])}: ${t(BEAUTY_ACTION_LABELS[action])}`}
                        />
                      </label>
                      {canOwn && (
                        <Select
                          name={`scope:${section}:${action}`}
                          aria-label={t('{section}: область просмотра', { section: t(BEAUTY_SECTION_LABELS[section]) })}
                          value={permission?.scope ?? 'OWN'}
                          disabled={!permission || !canEditDraft || busy}
                          onChange={(event) => setPermission(section, action, true, event.target.value as BeautyPermissionScope)}
                        >
                          <option value="OWN">{t('Только своё')}</option>
                          <option value="BUSINESS">{t('Весь салон')}</option>
                        </Select>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <label className="beauty-position-refund">
            <input
              type="checkbox"
              name="permission:finance:refund"
              checked={!!permissionOf(draft, 'finance', 'refund')}
              disabled={!canEditDraft || busy}
              onChange={(event) => setPermission('finance', 'refund', event.target.checked, 'BUSINESS')}
            />
            <span>
              <strong>{t('Возврат оплаты')}</strong>
              <small>{t('Отдельное право администратора на возврат денег клиенту.')}</small>
            </span>
          </label>

          {canEditDraft && (
            <div className="beauty-positions__actions">
              <Button type="submit" disabled={busy || !draft.name.trim()}>
                {draft.id ? t('Сохранить должность') : t('Создать должность')}
              </Button>
              {draft.id && canArchive && (
                <Button type="button" tone="danger" disabled={busy} onClick={() => void archivePosition()}>
                  {t('Архивировать')}
                </Button>
              )}
            </div>
          )}
        </form>
      </section>

      <section className="panel beauty-positions__assignments" aria-labelledby="beauty-assignment-heading">
        <div className="beauty-positions__heading">
          <div>
            <h2 id="beauty-assignment-heading">{t('Назначения сотрудников')}</h2>
            <p className="muted">{t('Доступ действует только в выбранном салоне или филиале.')}</p>
          </div>
        </div>

        {canUpdate && (
          <form className="beauty-assignment-form" onSubmit={assign}>
            <Field label={t('Сотрудник')} controlId="beauty-assignment-user" required>
              <Select
                id="beauty-assignment-user"
                name="assignmentUserId"
                value={assignmentUserId}
                disabled={busy}
                onChange={(event) => {
                  setAssignmentUserId(event.target.value);
                  setAssignmentLocationId('');
                  setState(null);
                }}
              >
                <option value="">{t('Выберите сотрудника')}</option>
                {workspace.members.map((member) => (
                  <option key={member.userId} value={member.userId}>{memberLabel(member)}</option>
                ))}
              </Select>
            </Field>
            <Field label={t('Должность')} controlId="beauty-assignment-position" required>
              <Select
                id="beauty-assignment-position"
                name="assignmentPositionId"
                value={assignmentPositionId}
                disabled={busy}
                onChange={(event) => {
                  setAssignmentPositionId(event.target.value);
                  setState(null);
                }}
              >
                <option value="">{t('Выберите должность')}</option>
                {activePositions.map((position) => (
                  <option key={position.id} value={position.id}>{position.name}</option>
                ))}
              </Select>
            </Field>
            <Field label={t('Филиал')} controlId="beauty-assignment-location" required>
              <Select
                id="beauty-assignment-location"
                name="assignmentLocationId"
                value={assignmentLocationId}
                disabled={busy}
                onChange={(event) => {
                  setAssignmentLocationId(event.target.value);
                  setState(null);
                }}
              >
                <option value="" disabled={!selectedMember?.businessWide}>{t('Весь салон')}</option>
                {allowedLocations.map((location) => (
                  <option key={location.id} value={location.id}>{location.name}</option>
                ))}
              </Select>
            </Field>
            <Button
              type="submit"
              disabled={
                busy ||
                !assignmentUserId ||
                !assignmentPositionId ||
                (!selectedMember?.businessWide && !assignmentLocationId)
              }
            >
              {t('Сохранить назначение')}
            </Button>
          </form>
        )}

        <div className="beauty-assignment-list">
          {workspace.assignments.length === 0 && <Notice tone="muted">{t('Назначений пока нет.')}</Notice>}
          {workspace.assignments.map((assignment) => {
            const member = workspace.members.find((item) => item.userId === assignment.userId);
            const position = workspace.positions.find((item) => item.id === assignment.positionId);
            const location = workspace.locations.find((item) => item.id === assignment.locationId);
            const revoked = assignment.revokedAt !== null;
            return (
              <article className="beauty-assignment" key={assignment.id}>
                <div>
                  <strong>{member ? memberLabel(member) : t('Сотрудник недоступен')}</strong>
                  <p>{position?.name ?? t('Должность недоступна')}, {location?.name ?? t('Весь салон')}</p>
                  {revoked && (
                    <p className="beauty-assignment__revoked">
                      <span>{t('Отозвано')}</span>. {t('Старая роль не вернёт доступ.')}
                    </p>
                  )}
                </div>
                {canUpdate && !revoked && (
                  <Button type="button" tone="danger" size="sm" disabled={busy} onClick={() => void revoke(assignment)}>
                    {t('Отозвать доступ')}
                  </Button>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {state?.error && <Alert boxed>{t(state.error)}</Alert>}
      {state?.message && <Alert tone="success" boxed>{t(state.message)}</Alert>}
      {dialog}
    </div>
  );
}
