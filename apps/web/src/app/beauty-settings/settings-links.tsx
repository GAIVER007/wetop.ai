import Link from 'next/link';

/**
 * Аудит 21.10.2026 п. 2: остальные настройки салона (профиль, специалисты, доступ, история) собраны в хабе «Настройки»
 * (`/settings`, поручение владельца 21.10.2026); отсюда к нему одна строка, без второго ряда карточек над формами.
 */
export function SettingsLinks() {
  return (
    <p className="settings-back" data-testid="settings-links">
      <Link href="/settings" prefetch={false}>
        ← Все настройки
      </Link>
      <span>Салон, филиалы, специалисты, доступ и история действий</span>
    </p>
  );
}
