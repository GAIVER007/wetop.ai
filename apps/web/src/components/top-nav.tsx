'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Icon } from './icon';
import { navigation, activeNavigation, type NavigationItem } from '../lib/navigation';
import { cx } from './ui';

function NavigationEntry({
  item,
  active,
  close,
}: {
  item: NavigationItem;
  active?: string | undefined;
  close?: (() => void) | undefined;
}) {
  const id = useId();
  const containsActive = item.children?.some((child) => child.href === active) ?? false;
  const [expanded, setExpanded] = useState(containsActive || item.href === active);
  // A newly visited child opens its parent; manual collapse remains possible on the current page.
  useEffect(() => {
    if (containsActive || item.href === active) setExpanded(true);
  }, [active, containsActive, item.href]);
  return (
    <div className="nav-entry">
      <div className="nav-entry-row">
        <Link
          href={item.href}
          prefetch={false}
          onClick={() => close?.()}
          className={cx(
            'workspace-link',
            active === item.href && 'is-active',
            containsActive && 'has-active-child',
          )}
          aria-current={active === item.href ? 'page' : undefined}
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </Link>
        {item.children && (
          <button
            type="button"
            className="nav-toggle"
            aria-label={`Подразделы: ${item.label}`}
            aria-expanded={expanded}
            aria-controls={id}
            onClick={() => setExpanded(!expanded)}
          >
            <Icon name="chevron" />
          </button>
        )}
      </div>
      {item.children && (
        <div id={id} className="nav-children" hidden={!expanded}>
          {item.children.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              prefetch={false}
              onClick={() => close?.()}
              className={cx('nav-child', active === child.href && 'is-active')}
              aria-current={active === child.href ? 'page' : undefined}
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Navigation({ path, close }: { path: string; close?: () => void }) {
  const active = activeNavigation(path)?.href;
  return (
    <>
      <Link
        href="/today"
        className="workspace-brand"
        onClick={() => close?.()}
        aria-label="WETOP — Сегодня"
      >
        <span className="workspace-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none">
            <path
              d="m5 9 5 15 6-11 6 11 5-15"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span>
          wetop<span className="brand-dot">.</span>
        </span>
      </Link>
      <div className="workspace-property">
        <span className="property-mark">
          <Icon name="inventory" />
        </span>
        <div>
          <strong>Luxx Aparts</strong>
          <span>Хостел · Алматы</span>
        </div>
      </div>
      <nav className="workspace-links" aria-label="Разделы">
        {navigation.map((group) => (
          <div key={group.label}>
            <div className="nav-group">{group.label}</div>
            {group.items.map((item) => (
              <NavigationEntry key={item.href} item={item} active={active} close={close} />
            ))}
          </div>
        ))}
      </nav>
      <div className="workspace-footer">
        <span className="desk-avatar">
          <Icon name="bed" />
        </span>
        <div>
          <strong>Стойка регистрации</strong>
          <span>Luxx Aparts · Алматы</span>
        </div>
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
  const section = activeNavigation(path);
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
            Luxx Aparts<span>/</span>
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
