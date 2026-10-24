import Link from 'next/link';

/**
 * Раздел «Сотрудники» ресторана одной полосой вкладок с подчёркиванием, как на макете (экран 11):
 * список, график смен (Q-REST-11), зарплата и роли с доступами. Вкладки это маршруты.
 */
export function StaffTabs({ current }: { current: 'list' | 'shifts' | 'payroll' }) {
  const items = [
    { href: '/employees', label: 'Список', id: 'list' },
    { href: '/employees/shifts', label: 'График смен', id: 'shifts' },
    { href: '/payroll', label: 'Зарплата', id: 'payroll' },
    { href: '/staff', label: 'Роли и доступы', id: 'roles' },
  ];
  return (
    <nav className="tabs rest-staff-tabs" aria-label="Раздел сотрудников">
      {items.map((i) => (
        <Link className="tabs__item" key={i.href} href={i.href} aria-current={current === i.id ? 'page' : undefined}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
