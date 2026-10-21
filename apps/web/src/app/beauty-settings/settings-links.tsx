import Link from 'next/link';

/** Аудит 21.10.2026 п. 2: остальные настройки салона живут в своих разделах, отсюда к ним одна ссылка-карточка */
const LINKS = [
  { href: '/branches', title: 'Салон и филиалы', text: 'Название, адрес, телефон, страна и валюта' },
  { href: '/employees', title: 'Специалисты', text: 'Мастера, их услуги и рабочие часы' },
  { href: '/team', title: 'Сотрудники и доступ', text: 'Кто входит в WETOP и что может делать' },
  { href: '/journal', title: 'История действий', text: 'Кто и что менял в салоне' },
];

export function SettingsLinks() {
  return (
    <ul className="settings-links" data-testid="settings-links" aria-label="Другие настройки">
      {LINKS.map((l) => (
        <li key={l.href}>
          <Link href={l.href}>
            <b>{l.title}</b>
            <span>{l.text}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
