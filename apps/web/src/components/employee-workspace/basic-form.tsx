'use client';
import { useId, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { type PersonnelKind } from '@pms/domain';
import { Alert, Button, Field, Input } from '../ui';
import { PhoneInput } from '../phone-input';
import { formatPhone } from '../../lib/phone';
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
  emailRequired = false,
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
  emailRequired?: boolean;
}) {
  const t = useT();
  const prefix = useId();
  const [firstName, setFirstName] = useState(() => draft.name.split(' ')[0] ?? '');
  const [lastName, setLastName] = useState(() => draft.name.split(' ').slice(1).join(' '));
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
      required={key === 'name' || (key === 'email' && emailRequired) ? true : undefined}
      {...(problem === key && error ? { error: t(error) } : {})}
    >
      {key === 'phone' ? (
        <PhoneInput
          name="phone"
          value={draft.phone}
          disabled={pending || disabled}
          onChange={(phone) => onChange({ ...draft, phone })}
        />
      ) : (
        <Input
          required={key === 'name' || (key === 'email' && emailRequired) ? true : undefined}
          name={key}
          placeholder={creating && key === 'email' ? 'example@example.com' : undefined}
          value={draft[key]}
          maxLength={key === 'name' ? 200 : 320}
          type={key === 'email' ? 'email' : 'text'}
          disabled={pending || disabled}
          onChange={(event) => onChange({ ...draft, [key]: event.target.value })}
        />
      )}
    </Field>
  );
  return (
    <form
      ref={formRef}
      className={`employee-workspace-form${creating ? ' employee-workspace-form--creating' : ''}`}
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
            {t(
              'Ваш ввод остаётся ниже. Отмените черновик и загрузите сохранённый профиль, затем внесите изменения заново.',
            )}
          </p>
        </section>
      )}
      {creating ? (
        <>
          <h3 className="staff-form-section-title">{t('Контакты')}</h3>
          <input type="hidden" name="name" value={draft.name} />
          <div className="staff-form-names">
            <Field label={t('Имя')} required controlId={`${prefix}-firstName`}>
              <Input
                name="firstName"
                value={firstName}
                required
                placeholder={t('Введите имя')}
                maxLength={100}
                disabled={pending || disabled}
                onChange={(event) => {
                  setFirstName(event.target.value);
                  onChange({
                    ...draft,
                    name: [event.target.value.trim(), lastName.trim()].filter(Boolean).join(' '),
                  });
                }}
              />
            </Field>
            <Field label={t('Фамилия')} controlId={`${prefix}-lastName`}>
              <Input
                name="lastName"
                value={lastName}
                placeholder={t('Введите фамилию')}
                maxLength={100}
                disabled={pending || disabled}
                onChange={(event) => {
                  setLastName(event.target.value);
                  onChange({
                    ...draft,
                    name: [firstName.trim(), event.target.value.trim()].filter(Boolean).join(' '),
                  });
                }}
              />
            </Field>
          </div>
        </>
      ) : (
        field('name', t('Имя мастера'))
      )}
      <div className="employee-workspace-contacts">
        {field('phone', t('Телефон'))}
        {field('email', creating ? t('Почта для входа') : t('Почта'))}
      </div>
      {creating && emailRequired && (
        <p className="employee-workspace-note">{t('Отправим приглашение на эту почту')}</p>
      )}
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
        <fieldset className="staff-personnel-kind">
          <legend>{t('Тип специалиста')}</legend>
          <div className="staff-choice-row">
            {(['SPECIALIST', 'OTHER_EMPLOYEE'] as const).map((kind) => (
              <label className="staff-choice" key={kind}>
                <input
                  type="radio"
                  name="personnelKind"
                  value={kind}
                  checked={
                    kind === 'SPECIALIST'
                      ? personnelKind !== 'OTHER_EMPLOYEE'
                      : personnelKind === kind
                  }
                  disabled={pending || disabled}
                  onChange={() => onPersonnelKindChange(kind)}
                />
                {kind === 'SPECIALIST' ? t('Специалист') : t('Другой сотрудник')}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {creating && access}
      <footer className={creating ? 'staff-form-footer' : undefined}>
        {creating && <p>{t('Приглашение действует 7 дней')}</p>}
        <div className="employee-workspace-actions">
          {!disabled && (
            <Button type="submit" disabled={pending || current !== null}>
              {pending
                ? t('Сохраняем…')
                : creating
                  ? emailRequired
                    ? t('Создать и пригласить')
                    : t('Добавить сотрудника')
                  : t('Сохранить изменения')}
            </Button>
          )}
          <Button type="button" tone="secondary" disabled={pending} onClick={onCancel}>
            {current ? t('Отменить черновик и загрузить профиль') : t('Отмена')}
          </Button>
        </div>
      </footer>
    </form>
  );
}
