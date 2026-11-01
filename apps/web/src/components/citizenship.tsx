'use client';
import { useCallback, useId, useRef, useState, type ReactNode } from 'react';
import { CITIZENSHIP_COUNTRIES } from '@pms/domain';
import { useLocale, useT } from '../i18n/locale-provider';
import { countryName } from '../lib/citizenship-name';
import { ConfirmDialog } from './confirm-dialog';
import { Alert, Field, Select } from './ui';

/**
 * Гражданство гостя выбором страны, а не ручным кодом «KAZ» (решение владельца 24.10.2026). В форму уходит тот же код
 * ISO alpha-3, что раньше вводили руками; неизвестный код из старых данных остаётся в списке и не теряется.
 */
export function CitizenshipSelect({
  name = 'citizenship',
  value,
  defaultValue,
  onChange,
  id,
  required,
  ...aria
}: {
  name?: string;
  value?: string;
  defaultValue?: string | null;
  onChange?: (code: string) => void;
  id?: string | undefined;
  required?: boolean | undefined;
  /** Field связывает подпись, пояснение и ошибку через эти атрибуты (components/ui Field) */
  'aria-describedby'?: string | undefined;
  'aria-invalid'?: boolean | 'true' | 'false' | undefined;
}) {
  const t = useT();
  const locale = useLocale();
  const current = (value ?? defaultValue ?? '').trim().toUpperCase();
  // страны по алфавиту языка человека, первые 15 частых стран списка остаются сверху (инструкция гостиницы 01.11.2026)
  const named = CITIZENSHIP_COUNTRIES.map((c) => ({ code: c.code, name: countryName(c.code, locale) ?? c.name }));
  const countries =
    locale === 'ru' ? named : [...named.slice(0, 15), ...named.slice(15).sort((a, b) => a.name.localeCompare(b.name, locale))];
  const known = current === '' || CITIZENSHIP_COUNTRIES.some((c) => c.code === current);
  const control = value !== undefined ? { value: current } : { defaultValue: current };
  return (
    <Select
      name={name}
      id={id}
      required={required}
      {...control}
      {...aria}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      data-testid="citizenship-select"
    >
      <option value="">{t('Не указано')}</option>
      {!known && <option value={current}>{countryName(current, locale)}</option>}
      {countries.map((c) => (
        <option key={c.code} value={c.code}>
          {c.name}
        </option>
      ))}
    </Select>
  );
}

/** Отказ заселения из-за пустого гражданства: текст API (reservations.service checkIn) */
export const isCitizenshipRefusal = (error: string | null | undefined) =>
  Boolean(error && /гражданств/i.test(error) && /заселен/i.test(error)); // kk-allow: сверка с текстом ответа API

/**
 * Окно «Укажите гражданство» прямо на заселении (шахматка и карточка брони): выбрать страну, сохранить в карточку
 * гостя и заселить одним нажатием, без похода в карточку гостя. `save` пишет гражданство основного гостя брони.
 */
export function useCitizenshipPrompt(save: (code: string) => Promise<{ error: string | null }>): {
  ask: (guest: string) => Promise<boolean>;
  dialog: ReactNode;
} {
  const [guest, setGuest] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const decide = useRef<((ok: boolean) => void) | null>(null);
  const controlId = useId();
  const t = useT();

  const ask = useCallback((name: string) => {
    decide.current?.(false);
    setGuest(name);
    setCode('');
    setError(null);
    return new Promise<boolean>((resolve) => {
      decide.current = resolve;
    });
  }, []);

  const finish = (ok: boolean) => {
    const resolve = decide.current;
    decide.current = null;
    setGuest(null);
    resolve?.(ok);
  };

  // окно в разметке только пока спрашиваем: на шахматке и в карточке уже есть своё окно подтверждения с тем же
  // data-testid, и второе закрытое мешало бы им (гейт PR 844: strict mode в chessboard-drag)
  const dialog = guest === null ? null : (
    <ConfirmDialog
      open
      title={t('Укажите гражданство гостя')}
      confirmLabel={t('Сохранить и заселить')}
      cancelLabel={t('Не сейчас')}
      tone="primary"
      pending={pending}
      confirmDisabled={!code}
      onCancel={() => finish(false)}
      onConfirm={() => {
        setPending(true);
        void save(code)
          .then((r) => {
            if (r.error) setError(r.error);
            else finish(true);
          })
          .finally(() => setPending(false));
      }}
    >
      <p>
        {t('{guest}: без гражданства заселение невозможно, гостя нужно зарегистрировать в eQonaq. Страна сохранится в карточке гостя.', { guest })}
      </p>
      <Field label={t('Гражданство')} controlId={controlId}>
        <CitizenshipSelect id={controlId} value={code} onChange={setCode} required />
      </Field>
      {error && <Alert>{error}</Alert>}
    </ConfirmDialog>
  );
  return { ask, dialog };
}
