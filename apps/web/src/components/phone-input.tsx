'use client';
import { useId, useState } from 'react';
import { PHONE_COUNTRIES } from '@pms/domain';
import { Field, Input, Select } from './ui';
import { useT } from '../i18n/locale-provider';

export function PhoneInput({
  value,
  onChange,
  name,
  id,
  disabled = false,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  name: string;
  id?: string;
  disabled?: boolean;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
}) {
  const t = useT();
  const generatedId = useId();
  const [emptyDial, setEmptyDial] = useState('+7');
  const digits = value.replace(/[^\d+]/g, '');
  const normalized = /^8\d{10}$/.test(digits) ? '+7' + digits.slice(1) : digits;
  const dial = normalized
    ? ([...PHONE_COUNTRIES]
        .sort((a, b) => b.dial.length - a.dial.length)
        .find((c) => normalized.startsWith(c.dial))?.dial ?? '+')
    : emptyDial;
  const national = normalized.startsWith(dial) ? normalized.slice(dial.length) : normalized;
  const dials = [...new Set(PHONE_COUNTRIES.map((c) => c.dial))];
  return (
    <span className="staff-phone">
      <Select
        aria-label={t('Код страны')}
        value={dial}
        disabled={disabled}
        onChange={(event) => {
          setEmptyDial(event.target.value);
          if (national) onChange(event.target.value + national);
        }}
      >
        {!dials.includes(dial) && <option value={dial}>{dial}</option>}
        {dials.map((code) => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </Select>
      <Input
        id={id ?? generatedId}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={national}
        disabled={disabled}
        maxLength={24}
        placeholder="900 123-45-67"
        aria-describedby={describedBy}
        aria-invalid={invalid}
        onChange={(event) => {
          const raw = event.target.value;
          const next = raw.replace(/\D/g, '');
          onChange(
            next
              ? raw.trim().startsWith('+')
                ? '+' + next
                : dial === '+7' && /^[78]\d{10}$/.test(next)
                  ? '+7' + next.slice(1)
                  : dial + next
              : '',
          );
        }}
      />
      <input type="hidden" name={name} value={value} disabled={disabled} />
    </span>
  );
}

export function PhoneInputExample() {
  const [value, setValue] = useState('');
  const id = useId();
  const t = useT();
  return (
    <Field label={t('Телефон')} controlId={id} required={false}>
      <PhoneInput name="examplePhone" value={value} onChange={setValue} />
    </Field>
  );
}
