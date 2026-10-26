'use client';
import { useState, useTransition } from 'react';
import { Alert, Field, Select } from './ui';
import { DESK_LOCALES, LOCALE_NAMES, msg } from '../i18n';
import { useT } from '../i18n/locale-provider';
import { saveOrganizationLocale } from './organization-locale-actions';


/**
 * Язык организации (ORG-LOCALE-20261026): на нём уходят приглашения сотрудникам, открываются экраны приглашения и
 * пароля, новый сотрудник входит с ним. Свой язык каждый меняет в профиле. Сохраняется сразу при выборе.
 */
export function OrganizationLocaleField({ value, canEdit }: { value: string; canEdit: boolean }) {
  const t = useT();
  const [current, setCurrent] = useState(value);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="organization-locale" data-testid="organization-locale">
      <Field label={t('Язык салона для сотрудников')}>
        <Select
          value={current}
          disabled={!canEdit || pending}
          aria-describedby="organization-locale-help"
          onChange={(e) => {
            const next = e.target.value;
            const before = current;
            setCurrent(next);
            setError('');
            setSaved(false);
            start(async () => {
              const result = await saveOrganizationLocale(next);
              if (result.error) {
                setCurrent(before);
                setError(result.error);
              } else setSaved(true);
            });
          }}
        >
          {/* названия языков на самих языках: их узнают и без перевода */}
          {DESK_LOCALES.map((code) => (
            <option key={code} value={code}>
              {LOCALE_NAMES[code]}
            </option>
          ))}
        </Select>
      </Field>
      <p className="setup-help" id="organization-locale-help">
        {t(
          msg(
            'На этом языке уходят приглашения сотрудникам, и новый сотрудник видит WETOP на нём с первого входа. Свой язык каждый меняет в профиле.',
          ),
        )}
      </p>
      {saved && <p role="status">{t('Язык сохранён')}</p>}
      {error && <Alert>{t(error)}</Alert>}
    </div>
  );
}
