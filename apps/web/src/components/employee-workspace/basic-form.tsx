'use client';
import { useId, type FormEvent, type ReactNode, type RefObject } from 'react';
import { PERSONNEL_KINDS, PERSONNEL_KIND_LABELS, type PersonnelKind } from '@pms/domain';
import { Alert, Button, Field, Input, Select } from '../ui';
import { formatPhone, formatPhoneInput } from '../../lib/phone';

export interface EmployeeProfileDraft {
  name: string;
  phone: string;
  email: string;
  active: boolean;
}

/** Shared basic fields, without services, account permissions or any server command. */
export function EmployeeBasicForm({
  draft,
  onChange,
  onSave,
  onCancel,
  creating,
  pending,
  disabled,
  error,
  current,
  formRef,
  personnelKind,
  onPersonnelKindChange,
  access = null,
}: {
  draft: EmployeeProfileDraft;
  onChange: (draft: EmployeeProfileDraft) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  creating: boolean;
  pending: boolean;
  disabled: boolean;
  error: string | null;
  current: EmployeeProfileDraft | null;
  formRef: RefObject<HTMLFormElement | null>;
  /** Назначение нового сотрудника: явный выбор руководителя в форме создания (решение 20.10.2026) */
  personnelKind?: PersonnelKind;
  onPersonnelKindChange?: (kind: PersonnelKind) => void;
  /** блок «Доступ в WETOP» под назначением (решение 20.10.2026) */
  access?: ReactNode;
}) {
  const prefix = useId();
  const problem =
    error && !current
      ? /имя/i.test(error)
        ? 'name'
        : /почт/i.test(error)
          ? 'email'
          : /телефон/i.test(error)
            ? 'phone'
            : null
      : null;
  const field = (key: 'name' | 'phone' | 'email', label: string) => (
    <Field
      label={label}
      controlId={`${prefix}-${key}`}
      required={key === 'name'}
      {...(problem === key ? { error: error ?? undefined } : {})}
    >
      <Input
        required={key === 'name'}
        name={key}
        value={draft[key]}
        maxLength={key === 'name' ? 200 : key === 'phone' ? 32 : 320}
        type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
        disabled={pending || disabled}
        onChange={(event) =>
          onChange({ ...draft, [key]: key === 'phone' ? formatPhoneInput(event.target.value) : event.target.value })
        }
      />
    </Field>
  );
  return (
    <form
      ref={formRef}
      className="employee-workspace-form"
      data-employee-transition-form
      onSubmit={onSave}
    >
      {error && (
        <div tabIndex={-1} data-employee-error>
          <Alert boxed>{error}</Alert>
        </div>
      )}
      {current && (
        <section className="employee-conflict" aria-label="Сохранённый профиль">
          <h3>Сейчас сохранено</h3>
          <dl>
            <dt>Имя</dt>
            <dd>{current.name}</dd>
            <dt>Телефон</dt>
            <dd>{current.phone ? formatPhone(current.phone) : 'Не указан'}</dd>
            <dt>Почта</dt>
            <dd>{current.email || 'Не указана'}</dd>
            <dt>Статус</dt>
            <dd>{current.active ? 'Активен' : 'В архиве'}</dd>
          </dl>
          <p>
            Ваш ввод остаётся ниже. Отмените черновик и загрузите сохранённый профиль, затем внесите изменения заново.
          </p>
        </section>
      )}
      {field('name', 'Имя мастера')}
      <div className="employee-workspace-contacts">
        {field('phone', 'Телефон')}
        {field('email', 'Почта')}
      </div>
      {!creating && (
        <label className="employee-workspace-status">
          <input
            type="checkbox"
            name="active"
            checked={draft.active}
            disabled={pending || disabled}
            onChange={(event) => onChange({ ...draft, active: event.target.checked })}
          />
          Специалист работает
        </label>
      )}
      {creating && personnelKind && onPersonnelKindChange && (
        <Field
          label="Кто это"
          controlId={`${prefix}-personnelKind`}
          hint="Специалист принимает клиентов, другой сотрудник помогает в работе салона."
        >
          <Select
            name="personnelKind"
            value={personnelKind}
            disabled={pending || disabled}
            onChange={(event) => onPersonnelKindChange(event.target.value as PersonnelKind)}
          >
            {PERSONNEL_KINDS.map((value) => (
              <option key={value} value={value}>
                {PERSONNEL_KIND_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {creating && access}
      {creating && (
        <p className="employee-workspace-note">
          Услуги и рабочее время можно настроить после создания.
        </p>
      )}
      <div className="employee-workspace-actions">
        {!disabled && (
          <Button type="submit" disabled={pending || current !== null}>
            {pending ? 'Сохраняем…' : creating ? 'Создать мастера' : 'Сохранить изменения'}
          </Button>
        )}
        <Button type="button" tone="secondary" disabled={pending} onClick={onCancel}>
          {current ? 'Отменить черновик и загрузить профиль' : 'Отмена'}
        </Button>
      </div>
    </form>
  );
}
