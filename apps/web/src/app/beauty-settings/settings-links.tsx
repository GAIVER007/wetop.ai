'use client';
import Link from 'next/link';
import { useT } from '../../i18n/locale-provider';

/**
 * Аудит 21.10.2026 п. 2: остальные настройки салона (профиль, специалисты, доступ, история) собраны в хабе «Настройки»
 * (`/settings`, поручение владельца 21.10.2026); отсюда к нему одна строка, без второго ряда карточек над формами.
 */
export function SettingsLinks() {
  const t = useT();
  return (
    <p className="settings-back" data-testid="settings-links">
      <Link href="/settings">
        ← {t('Все настройки')}
      </Link>
      <span>{t('Салон, филиалы, специалисты, доступ и история действий')}</span>
    </p>
  );
}
