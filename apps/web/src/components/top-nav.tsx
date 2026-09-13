'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import { Icon, type IconName } from './icon';
import { cx } from './ui';

const sections: Array<{ href: string; label: string; icon: IconName; group: string }> = [
  { href: '/today', label: 'Сегодня', icon: 'today', group: 'Рабочее место' },
  { href: '/chessboard', label: 'Шахматка', icon: 'board', group: 'Рабочее место' },
  { href: '/guests', label: 'Гости', icon: 'guests', group: 'Рабочее место' },
  { href: '/finance', label: 'Деньги', icon: 'money', group: 'Управление' },
  { href: '/rates', label: 'Цены', icon: 'rates', group: 'Управление' },
  { href: '/inventory', label: 'Номерной фонд', icon: 'inventory', group: 'Управление' },
  { href: '/channels', label: 'Каналы', icon: 'channels', group: 'Управление' },
  { href: '/analytics', label: 'Аналитика', icon: 'analytics', group: 'Управление' },
  { href: '/journal', label: 'Журнал', icon: 'journal', group: 'Система' },
  { href: '/analytics/setup', label: 'Настройки сайта', icon: 'settings', group: 'Система' },
];

function Navigation({ path, close }: { path: string; close?: () => void }) {
  // Самый точный маршрут побеждает: /analytics/setup не подсвечивает два раздела.
  const active = sections
    .filter((s) => path === s.href || path.startsWith(`${s.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <>
      <Link
        href="/today"
        className="workspace-brand"
        onClick={() => close?.()}
        aria-label="WETOP — Сегодня"
      >
        <span className="workspace-mark">w</span>
        <span>
          wetop<span className="brand-dot">.</span>
        </span>
      </Link>
      <div className="workspace-property">
        <span className="property-mark">L</span>
        <div>
          <strong>Luxx Aparts</strong>
          <span>Хостел · Алматы</span>
        </div>
      </div>
      <nav className="workspace-links" aria-label="Разделы">
        {sections.map((s, i) => (
          <div key={s.href}>
            {s.group !== sections[i - 1]?.group && <div className="nav-group">{s.group}</div>}
            <Link
              href={s.href}
              onClick={() => close?.()}
              className={cx('workspace-link', active === s.href && 'is-active')}
              aria-current={active === s.href ? 'page' : undefined}
            >
              <Icon name={s.icon} />
              <span>{s.label}</span>
            </Link>
          </div>
        ))}
      </nav>
      <div className="workspace-footer">
        <span className="footer-line" />
        Всё для вашей смены<span>Номера, койки и гости — в одном месте</span>
      </div>
    </>
  );
}

/** Клиентский shell получает серверные страницы слотом; данные не переносятся в клиентский bundle. */
export function TopNav({ children }: { children: ReactNode }) {
  const path = usePathname() ?? '';
  const router = useRouter();
  const search = useRef<HTMLDialogElement>(null);
  const menu = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && !path.includes('/print')) {
        e.preventDefault();
        if (!search.current?.open) search.current?.showModal();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [path]);
  if (path.includes('/print')) return <>{children}</>;
  const section = sections
    .filter((s) => path === s.href || path.startsWith(`${s.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return (
    <div className="workspace">
      <a className="skip-link" href="#main-content">
        К содержимому
      </a>
      <aside className="workspace-sidebar">
        <Navigation path={path} />
      </aside>
      <div className="workspace-body">
        <header className="workspace-header">
          <button
            className="icon-button mobile-menu"
            onClick={() => menu.current?.showModal()}
            aria-label="Открыть меню"
          >
            <Icon name="menu" />
          </button>
          <div className="workspace-breadcrumb">
            Рабочее пространство<span>/</span>
            <strong>{section?.label ?? 'Бронирование'}</strong>
          </div>
          <button
            className="workspace-search"
            aria-label="Найти гостя или бронь"
            onClick={() => search.current?.showModal()}
          >
            <Icon name="search" />
            <span>Найти гостя или бронь</span>
            <kbd>⌘ K</kbd>
          </button>
          <Link href="/reservations/new" className="btn workspace-create">
            <Icon name="plus" />
            <span>Новая бронь</span>
          </Link>
        </header>
        {children}
      </div>
      <dialog ref={menu} className="mobile-navigation" aria-label="Навигация">
        <button
          className="icon-button menu-close"
          onClick={() => menu.current?.close()}
          aria-label="Закрыть меню"
        >
          <Icon name="close" />
        </button>
        <Navigation path={path} close={() => menu.current?.close()} />
      </dialog>
      <dialog ref={search} className="search-dialog" aria-labelledby="quick-search-title">
        <div className="dialog-heading">
          <h2 id="quick-search-title">Быстрый поиск</h2>
          <button
            className="icon-button"
            onClick={() => search.current?.close()}
            aria-label="Закрыть поиск"
          >
            <Icon name="close" />
          </button>
        </div>
        <p className="muted">Найдите гостя или откройте бронь по её полному номеру.</p>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const q = String(data.get('query') ?? '').trim();
            if (!q) return;
            search.current?.close();
            router.push(
              data.get('kind') === 'booking'
                ? `/reservations/${encodeURIComponent(q)}`
                : `/guests?q=${encodeURIComponent(q)}`,
            );
          }}
        >
          <label className="field">
            Искать
            <select className="inp" name="kind">
              <option value="guest">Гостя по имени, телефону или email</option>
              <option value="booking">Бронь по номеру</option>
            </select>
          </label>
          <label className="field">
            Запрос
            <input
              className="inp"
              name="query"
              autoComplete="off"
              required
              minLength={2}
              placeholder="Имя гостя или номер брони"
            />
          </label>
          <button className="btn" type="submit">
            <Icon name="search" />
            Найти
          </button>
        </form>
      </dialog>
    </div>
  );
}
