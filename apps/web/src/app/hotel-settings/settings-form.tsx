'use client';
import { useActionState, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Field, Input, Panel } from '../../components/ui';
import type { HotelSettings } from '../../lib/hotel-api';
import { saveHotelSettings, type SettingsActionResult } from './actions';
import { SETTINGS_FORM_ID, useSaveReport } from './settings-save';

type Property = HotelSettings['property'];
type FieldName = keyof Property;

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
  children,
}: {
  property: Property;
  fields: readonly FieldName[];
  testId: string;
  children: (value: (name: FieldName) => string) => ReactNode;
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
  return (
    <form
      id={SETTINGS_FORM_ID}
      ref={form}
      action={action}
      key={state?.attempt ?? 0}
      onChange={recompute}
      data-testid={testId}
      className="settings-form"
      noValidate
    >
      {state?.error && <Alert boxed>{state.error}</Alert>}
      {children((name) => kept?.[name] ?? stored(name))}
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

export function StaySettingsForm({ property }: { property: Property }) {
  return (
    <SettingsForm property={property} fields={STAY} testId="stay-form">
      {(value) => (
        <Panel className="settings-block" aria-labelledby="settings-stay" data-testid="stay-settings">
          <h2 id="settings-stay">Заезд и выезд</h2>
          <div className="settings-fields settings-fields--times">
            <Field label="Заезд с">
              <Input name="checkInTime" type="time" required defaultValue={value('checkInTime')} />
            </Field>
            <Field label="Выезд до">
              <Input name="checkOutTime" type="time" required defaultValue={value('checkOutTime')} />
            </Field>
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
    <Panel className="settings-block" aria-labelledby="settings-region">
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
