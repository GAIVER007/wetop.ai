'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from './ui';

/** Разделы стойки в порядке смены: с чего начинается день — слева. */
const SECTIONS: ReadonlyArray<readonly [href: string, label: string]> = [
  ['/today', 'Сегодня'],
  ['/chessboard', 'Шахматка'],
  ['/guests', 'Гости'],
  ['/rates', 'Цены'],
  ['/channels', 'Каналы'],
  ['/finance', 'Деньги'],
  ['/inventory', 'Номерной фонд'],
  ['/journal', 'Журнал'],
  ['/incidents', 'Неисправности'],
  ['/analytics', 'Аналитика'],
];

/**
 * Верхняя навигация. Клиентский компонент только ради подсветки текущего раздела.
 * На печатных формах не показывается (они уходят на принтер как есть). Без `ul/li`: e2e ищут
 * `li` на страницах без привязки к контейнеру.
 */
export function TopNav() {
  const path = usePathname() ?? '';
  if (path.includes('/print')) return null;
  const active = (href: string) => path === href || path.startsWith(`${href}/`);
  return (
    <header className="topbar">
      <div className="topbar__inner">
        <Link href="/today" className="topbar__brand">
          <svg
            className="topbar__mark"
            width="24"
            height="24"
            viewBox="0 0 26 26"
            aria-hidden="true"
          >
            <rect x="1" y="1" width="24" height="24" rx="6" fill="currentColor" />
            <path
              d="M8 6.5v13h10"
              fill="none"
              stroke="#fff"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Luxx Aparts<span>PMS</span>
        </Link>
        <nav className="topbar__nav" aria-label="Разделы">
          {SECTIONS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={cx('topbar__link', active(href) && 'topbar__link--active')}
              aria-current={active(href) ? 'page' : undefined}
            >
              {label}
            </Link>
          ))}
          <Link
            href="/reservations/new"
            className="topbar__link topbar__link--accent"
            aria-current={active('/reservations/new') ? 'page' : undefined}
          >
            + Новая бронь
          </Link>
        </nav>
      </div>
    </header>
  );
}
