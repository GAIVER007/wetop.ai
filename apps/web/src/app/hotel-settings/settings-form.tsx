'use client';
import {
  useActionState,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { normalizeClockTime } from '@pms/domain';
import { Alert, Field, Input, Panel } from '../../components/ui';
import type { HotelSettings } from '../../lib/hotel-api';
import { saveHotelSettings, type SettingsActionResult } from './actions';
import { SETTINGS_FORM_ID, useSaveReport } from './settings-save';

type Property = HotelSettings['property'];
type FieldName = keyof Property;
/** Проверка поля до отправки: причина словами или null. Ошибка стоит у поля (DESIGN.md §8: `aria-invalid` + текст под полем) */
type Validate = (name: FieldName, raw: string) => string | null;
type Check = (name: FieldName) => {
  props: { 'aria-invalid'?: true; 'aria-describedby'?: string };
  error: ReactNode;
};

/**
 * Одна форма вкладки «Настроек объекта» (ТЗ ux-retention п. 3.1, UQ-1; ТЗ «Настройки объекта» v2, ADR-115). Шлёт
 * только свои поля — разбор API принимает любое подмножество, и «Проживание» не затирает «Основное». «Есть
 * изменения» считается сравнением ввода с записью объекта: вернули старое значение — кнопка снова выключена.
 * Отказ API не стирает ввод (`values` + `attempt`).
 */
function SettingsForm({
  property,
  fields,
  testId,
  validate,
  children,
}: {
  property: Property;
  fields: readonly FieldName[];
  testId: string;
  validate?: Validate;
  children: (value: (name: FieldName) => string, check: Check) => ReactNode;
}) {
  const [state, action, pending] = useActionState<SettingsActionResult | null, FormData>(
    saveHotelSettings,
    null,
  );
  const form = useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = useState(false);
  const stored = (name: FieldName) => String(property[name] ?? '');
  const recompute = useCallback(() => {
    const data = form.current ? new FormData(form.current) : null;
    setDirty(
      !!data &&
        fields.some((name) => String(data.get(name) ?? '').trim() !== String(property[name] ?? '')),
    );
  }, [fields, property]);
  // после ответа API: ввод остался (отказ) или запись объекта обновилась (сохранено) — пересчитать
  useEffect(recompute, [recompute, state]);
  useSaveReport({ dirty, pending, saved: !!state?.message && !dirty });
  const kept = state?.values;
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const errorPrefix = useId();
  const checkField = (name: FieldName, raw: string) =>
    setErrors((was) => {
      const reason = validate?.(name, raw) ?? null;
      if ((was[name] ?? null) === reason) return was;
      const next = { ...was };
      if (reason) next[name] = reason;
      else delete next[name];
      return next;
    });
  const fieldOf = (target: EventTarget) =>
    target instanceof HTMLInputElement && (fields as readonly string[]).includes(target.name)
      ? (target as HTMLInputElement & { name: FieldName })
      : null;
  const check: Check = (name) =>
    errors[name]
      ? {
          props: { 'aria-invalid': true, 'aria-describedby': `${errorPrefix}-${name}` },
          error: <Alert id={`${errorPrefix}-${name}`}>{errors[name]}</Alert>,
        }
      : { props: {}, error: null };
  return (
    <form
      id={SETTINGS_FORM_ID}
      ref={form}
      action={action}
      key={state?.attempt ?? 0}
      onChange={(event) => {
        recompute();
        // поле с ошибкой проверяем на ходу — как только ввод исправлен, причина уходит
        const input = fieldOf(event.target);
        if (input && errors[input.name]) checkField(input.name, input.value);
      }}
      onBlur={(event) => {
        const input = fieldOf(event.target);
        if (input && input.value.trim() !== '') checkField(input.name, input.value);
      }}
      onSubmit={(event) => {
        if (!validate) return;
        const data = new FormData(event.currentTarget);
        const found: Partial<Record<FieldName, string>> = {};
        for (const name of fields) {
          const reason = validate(name, String(data.get(name) ?? ''));
          if (reason) found[name] = reason;
        }
        setErrors(found);
        if (Object.keys(found).length) event.preventDefault();
      }}
      data-testid={testId}
      className={`settings-form ${testId === 'hotel-settings-form' ? 'settings-form--general' : ''}`}
      noValidate
    >
      {state?.error && <Alert boxed>{state.error}</Alert>}
      {children((name) => kept?.[name] ?? stored(name), check)}
    </form>
  );
}

const GENERAL = ['name', 'phone', 'email', 'address', 'legalName', 'bin'] as const;
const STAY = ['checkInTime', 'checkOutTime'] as const;

export function GeneralSettingsForm({ property }: { property: Property }) {
  return (
    <SettingsForm property={property} fields={GENERAL} testId="hotel-settings-form">
      {(value) => (
        <>
          <Panel className="settings-block" aria-labelledby="settings-main">
            <h2 id="settings-main">Основная информация</h2>
            <div className="settings-fields">
              <Field label="Название объекта" className="settings-fields__wide">
                <Input name="name" required maxLength={200} defaultValue={value('name')} />
              </Field>
              <Field label="Телефон">
                <Input name="phone" type="tel" defaultValue={value('phone')} />
              </Field>
              <Field label="Почта">
                <Input name="email" type="email" defaultValue={value('email')} />
              </Field>
              <Field label="Адрес" className="settings-fields__wide">
                <Input name="address" maxLength={300} defaultValue={value('address')} />
              </Field>
            </div>
          </Panel>
          <RegionalSettings property={property} />
          <Panel className="settings-block" aria-labelledby="settings-legal">
            <h2 id="settings-legal">Юридическое лицо</h2>
            <p className="settings-note">Печатаются в договоре и счёте гостя.</p>
            <div className="settings-fields">
              <Field label="Юридическое название">
                <Input name="legalName" maxLength={300} defaultValue={value('legalName')} />
              </Field>
              <Field label="ИИН/БИН">
                <Input name="bin" inputMode="numeric" maxLength={12} defaultValue={value('bin')} />
              </Field>
            </div>
          </Panel>
        </>
      )}
    </SettingsForm>
  );
}

/** Время — всегда 24 часа (DESIGN.md §14): не `type="time"`, который рисует «02:00 PM» по языку браузера */
const validateStay: Validate = (name, raw) =>
  normalizeClockTime(raw) === null
    ? `Время ${name === 'checkInTime' ? 'заезда' : 'выезда'} — в виде 14:00`
    : null;

export function StaySettingsForm({ property }: { property: Property }) {
  return (
    <SettingsForm property={property} fields={STAY} testId="stay-form" validate={validateStay}>
      {(value, check) => (
        <Panel
          className="settings-block"
          aria-labelledby="settings-stay"
          data-testid="stay-settings"
        >
          <h2 id="settings-stay">Заезд и выезд</h2>
          <div className="settings-fields settings-fields--times">
            {(
              [
                ['checkInTime', 'Заезд с', '14:00'],
                ['checkOutTime', 'Выезд до', '12:00'],
              ] as const
            ).map(([name, label, hint]) => {
              const { props, error } = check(name);
              return (
                <Field key={name} label={label}>
                  <Input
                    name={name}
                    required
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={5}
                    placeholder={hint}
                    className="settings-time"
                    defaultValue={value(name)}
                    {...props}
                  />
                  {error}
                </Field>
              );
            })}
          </div>
          <StayNote timezone={property.timezone} />
        </Panel>
      )}
    </SettingsForm>
  );
}

/** Валюта и пояс — только просмотр при любых правах: от них зависят суммы и границы ночей */
export function RegionalSettings({ property: p }: { property: Property }) {
  return (
    <Panel className="settings-block settings-region" aria-labelledby="settings-region">
      <h2 id="settings-region">Региональные настройки</h2>
      <dl className="settings-facts">
        <div>
          <dt>Часовой пояс</dt>
          <dd>{p.timezone}</dd>
        </div>
        <div>
          <dt>Валюта</dt>
          <dd>{p.currency}</dd>
        </div>
      </dl>
      <p className="settings-note">
        Меняет поддержка WETOP: от них зависят цены, счета и границы ночей.
      </p>
    </Panel>
  );
}

/** Где видны часы. Ночи от них не зависят — проживание хранится датами (AGENTS.md §13) */
export function StayNote({ timezone }: { timezone: string }) {
  return (
    <p className="settings-note">
      По времени объекта ({timezone}). Эти часы печатаются в договоре, их видит гость в модуле
      бронирования на сайте, по ним отвечает ИИ-продавец.
    </p>
  );
}
