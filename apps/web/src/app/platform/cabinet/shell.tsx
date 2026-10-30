import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon, type IconName } from '../../../components/icon';
import { formatInt } from '../../../lib/dashboard-format';
import { msg, type Translate } from '../../../i18n';
import './cabinet.css';

/** Разделы кабинета компании WETOP (вариант «Г»): меню слева у всех страниц кабинета */
export type CabinetSection = 'home' | 'clients' | 'site' | 'countries' | 'money' | 'subscriptions' | 'team';

const LINKS: Array<{
  key: CabinetSection | 'support';
  href: string;
  icon: IconName;
  label: string;
}> = [
  { key: 'home', href: '/platform/cabinet', icon: 'today', label: msg('Главная') },
  { key: 'clients', href: '/platform/cabinet/clients', icon: 'guests', label: msg('Клиенты') },
  { key: 'site', href: '/platform/cabinet/site', icon: 'globe', label: msg('Сайт wetop.ai') },
  { key: 'countries', href: '/platform/cabinet/countries', icon: 'pin', label: msg('Страны') },
  { key: 'money', href: '/platform/cabinet/money', icon: 'chart', label: msg('Деньги') },
  {
    key: 'subscriptions',
    href: '/platform/cabinet/subscriptions',
    icon: 'booking',
    label: msg('Подписки'),
  },
  { key: 'team', href: '/platform/cabinet/team', icon: 'person', label: msg('Сотрудники') },
  { key: 'support', href: '/platform/support', icon: 'chat', label: msg('Поддержка') },
];

export function CabinetShell({
  active,
  t,
  clients,
  side,
  children,
}: {
  active: CabinetSection;
  t: Translate;
  clients?: number | undefined;
  side?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="cabinet" data-testid="cabinet">
      <div className="cabinet__side">
        <nav className="cabinet__menu" aria-label={t('Кабинет WETOP')}>
          {LINKS.map((l) => (
            <Link
              key={l.key}
              className="cabinet__link"
              aria-current={l.key === active ? 'page' : undefined}
              href={l.href}
              prefetch={false}
            >
              <Icon name={l.icon} />
              {t(l.label)}
              {l.key === 'clients' && clients !== undefined && (
                <span className="cabinet__count">{formatInt(clients)}</span>
              )}
            </Link>
          ))}
        </nav>
        {side}
      </div>
      <div className="cabinet__main">{children}</div>
    </div>
  );
}

/** Центы USD строкой в «$1 250» или «$49,50»; отрицательное с «−»; без чисел с плавающей точкой */
export function usd(cents: string | null | undefined): string {
  if (cents === null || cents === undefined || cents === '') return '';
  const v = BigInt(cents);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const rest = abs % 100n;
  return `${neg ? '\u2212' : ''}$${whole}${rest ? `,${rest.toString().padStart(2, '0')}` : ''}`;
}

/** Центы строкой в значение поля ввода: из `4950` получается `49.50`, из `9900` получается `99` */
export function centsToInput(cents: string | null | undefined): string {
  if (!cents) return '';
  const v = BigInt(cents);
  const rest = v % 100n;
  return `${v / 100n}${rest ? `.${rest.toString().padStart(2, '0')}` : ''}`;
}

/** День `2026-10-28` в виде `28.10.2026` */
export function dayText(iso: string | null | undefined): string {
  if (!iso) return '';
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
}
