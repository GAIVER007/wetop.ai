import Link from 'next/link';
import { msg } from '../../i18n';
import { Labelled, T } from '../../i18n/locale-provider';

/**
 * Раздел «Сотрудники» ресторана одной полосой вкладок с подчёркиванием, как на макете (экран 11):
 * список, график смен (Q-REST-11), зарплата и роли с доступами. Вкладки это маршруты.
 */
export function StaffTabs({ current }: { current: 'list' | 'shifts' | 'payroll' }) {
  const items = [
    { href: '/employees', label: msg('Список'), id: 'list' },
    { href: '/employees/shifts', label: msg('График смен'), id: 'shifts' },
    { href: '/payroll', label: msg('Зарплата'), id: 'payroll' },
    { href: '/staff', label: msg('Роли и доступы'), id: 'roles' },
  ];
  return (
    <Labelled as="nav" className="tabs rest-staff-tabs" label={msg('Раздел сотрудников')}>
      {items.map((i) => (
        <Link className="tabs__item" key={i.href} href={i.href} aria-current={current === i.id ? 'page' : undefined}>
          <T text={i.label} />
        </Link>
      ))}
    </Labelled>
  );
}
