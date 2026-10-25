'use client';
import { useId, type FormEvent, type ReactNode, type RefObject } from 'react';
import { PERSONNEL_KINDS, PERSONNEL_KIND_LABELS, type PersonnelKind } from '@pms/domain';
import { Alert, Button, Field, Input, Select } from '../ui';
import { formatPhone, formatPhoneInput } from '../../lib/phone';
import { useT } from '../../i18n/locale-provider';

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
  const t = useT();
  const prefix = useId();
  // ошибка хранится по-русски (текст API и проверки ввода), переводится при показе: поле ищется по русскому слову
  const problem =
    error && !current
      ? /имя/i.test(error) // kk-allow: сверка с русским текстом ошибки API
        ? 'name'
        : /почт/i.test(error) // kk-allow: сверка с русским текстом ошибки API
          ? 'email'
          : /телефон/i.test(error) // kk-allow: сверка с русским текстом ошибки API
            ? 'phone'
            : null
      : null;
  const field = (key: 'name' | 'phone' | 'email', label: string) => (
    <Field
      label={label}
      controlId={`${prefix}-${key}`}
      required={key === 'name'}
      {...(problem === key && error ? { error: t(error) } : {})}
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
          <Alert boxed>{t(error)}</Alert>
        </div>
      )}
      {current && (
        <section className="employee-conflict" aria-label={t('Сохранённый профиль')}>
          <h3>{t('Сейчас сохранено')}</h3>
          <dl>
            <dt>{t('Имя')}</dt>
            <dd>{current.name}</dd>
            <dt>{t('Телефон')}</dt>
            <dd>{current.phone ? formatPhone(current.phone) : t('Не указан')}</dd>
            <dt>{t('Почта')}</dt>
            <dd>{current.email || t('Не указана')}</dd>
            <dt>{t('Статус')}</dt>
            <dd>{current.active ? t('Активен') : t('В архиве')}</dd>
          </dl>
          <p>
            {t('Ваш ввод остаётся ниже. Отмените черновик и загрузите сохранённый профиль, затем внесите изменения заново.')}
          </p>
        </section>
      )}
      {field('name', t('Имя мастера'))}
      <div className="employee-workspace-contacts">
        {field('phone', t('Телефон'))}
        {field('email', t('Почта'))}
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
          {t('Специалист работает')}
        </label>
      )}
      {creating && personnelKind && onPersonnelKindChange && (
        <Field
          label={t('Кто это')}
          controlId={`${prefix}-personnelKind`}
          hint={t('Специалист принимает клиентов, другой сотрудник помогает в работе салона.')}
        >
          <Select
            name="personnelKind"
            value={personnelKind}
            disabled={pending || disabled}
            onChange={(event) => onPersonnelKindChange(event.target.value as PersonnelKind)}
          >
            {PERSONNEL_KINDS.map((value) => (
              <option key={value} value={value}>
                {t(PERSONNEL_KIND_LABELS[value])}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {creating && access}
      {creating && (
        <p className="employee-workspace-note">
          {t('Услуги и рабочее время можно настроить после создания.')}
        </p>
      )}
      <div className="employee-workspace-actions">
        {!disabled && (
          <Button type="submit" disabled={pending || current !== null}>
            {pending ? t('Сохраняем…') : creating ? t('Создать мастера') : t('Сохранить изменения')}
          </Button>
        )}
        <Button type="button" tone="secondary" disabled={pending} onClick={onCancel}>
          {current ? t('Отменить черновик и загрузить профиль') : t('Отмена')}
        </Button>
      </div>
    </form>
  );
}
