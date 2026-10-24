'use client';
import { useState, useTransition } from 'react';
import { changeLocale } from '../../app/locale-actions';
import { DESK_LOCALES, LOCALE_NAMES, type DeskLocale } from '../../i18n';
import { useT } from '../../i18n/locale-provider';
import { Icon } from '../icon';
import { Segmented } from '../segmented';

const OPTIONS = DESK_LOCALES.map((code) => ({ value: code, label: LOCALE_NAMES[code] }));

/**
 * Язык стойки в меню профиля (ADR-163, KK1): готовый переключатель `Segmented` (DESIGN.md §8.1) и серверное действие.
 * Названия языков пишутся на самих языках и не переводятся: человек ищет свой язык по его виду.
 */
export function LocaleSwitch({ locale }: { locale: DeskLocale }) {
  const t = useT();
  const [value, setValue] = useState(locale);
  const [pending, start] = useTransition();
  return (
    <div className="profile-dropdown__locale">
      <Icon name="globe" />
      <Segmented
        label={t('Язык')}
        size="sm"
        value={value}
        options={OPTIONS}
        disabled={pending}
        onChange={(next) => {
          setValue(next);
          start(async () => {
            const form = new FormData();
            form.set('locale', next);
            await changeLocale(form);
          });
        }}
      />
    </div>
  );
}
