'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from './icon';
import { Sidebar, type PropertyIdentity } from './shell/sidebar';
import { GlobalSearch } from './shell/search';
import { Overlay } from './overlay';
import { useTheme } from './theme-provider';
import { cx } from './ui';
import { activeNavigation } from '../lib/navigation';
export function TopNav({
  children,
  demo = false,
  property = null,
}: {
  children: ReactNode;
  demo?: boolean;
  property?: PropertyIdentity | null;
}) {
  const path = usePathname() ?? '';
  const [search, setSearch] = useState(false);
  const [menu, setMenu] = useState(false);
  const [profile, setProfile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { setTheme } = useTheme();
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('wetop.sidebar') === 'collapsed');
    } catch {
      /* Optional preference. */
    }
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && !path.includes('/print')) {
        e.preventDefault();
        setSearch((s) => !s);
      }
      if (e.key === 'Escape') setProfile(false);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [path]);
  useEffect(() => {
    setProfile(false);
  }, [path]);
  if (path.includes('/print') || path === '/login' || path === '/register') return <>{children}</>;
  const collapse = () => {
    setCollapsed(!collapsed);
    try {
      localStorage.setItem('wetop.sidebar', collapsed ? 'expanded' : 'collapsed');
    } catch {
      /* Optional preference. */
    }
  };
  const nav = [
    { href: '/today', label: 'Главная', icon: 'today' },
    { href: '/reservations', label: 'Брони', icon: 'booking' },
    { href: '/guests', label: 'Гости', icon: 'guests' },
    { href: '/chessboard', label: 'Шахматка', icon: 'board' },
  ] as const;
  return (
    <div className={cx('workspace', collapsed && 'is-collapsed')}>
      <a className="skip-link" href="#main-content">
        К содержимому
      </a>
      <aside className="workspace-sidebar">
        <Sidebar
          property={property}
          path={path}
          collapsed={collapsed}
          onCollapse={collapse}
        />
      </aside>
      <div className="workspace-body">
        <header className="workspace-header">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMenu(true)}
            aria-label="Открыть меню"
          >
            <Icon name="menu" />
          </button>
          <button
            className="workspace-search"
            aria-label="Найти гостя или бронь"
            onClick={() => setSearch(true)}
          >
            <Icon name="search" />
            <span>Поиск гостя, брони, номера...</span>
            <kbd>⌘ K</kbd>
          </button>
          <div className="header-tools">
            {demo && (
              <span
                className="demo-indicator"
                title="Вымышленные данные. Изменения не отправляются во внешние сервисы."
              >
                Демо
              </span>
            )}
            <button
              className="icon-button theme-switch"
              aria-label="Переключить тему"
              title="Светлая / тёмная тема"
              onClick={() =>
                setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark')
              }
            >
              <Icon name="sun" className="theme-sun" />
              <Icon name="moon" className="theme-moon" />
            </button>
            <div className="profile-menu">
              <button
                className="profile-trigger"
                aria-label="Меню администратора"
                aria-expanded={profile}
                aria-controls="profile-dropdown"
                onClick={() => setProfile(!profile)}
              >
                <span className="desk-avatar">АД</span>
                <span className="profile-caption">
                  <strong>Администратор</strong>
                  <small>{property?.name ?? 'Объект не загружен'}</small>
                </span>
                <Icon name="down" width={14} />
              </button>
              {profile && (
                <>
                  <button
                    className="dropdown-dismiss"
                    aria-label="Закрыть меню профиля"
                    onClick={() => setProfile(false)}
                  />
                  <div className="profile-dropdown" id="profile-dropdown">
                    <span className="eyebrow">Рабочее пространство</span>
                    <Link href="/profile">
                      <Icon name="guests" />
                      Профиль и предпочтения
                    </Link>
                    <Link href="/hotel-settings">
                      <Icon name="settings" />
                      Настройки объекта
                    </Link>
                    <button
                      onClick={() => {
                        setTheme('system');
                        setProfile(false);
                      }}
                    >
                      <Icon name="system" />
                      Тема устройства
                    </button>
                    <Link href="/login">
                      <Icon name="departure" />
                      Экран входа
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        {demo && (
          <div className="demo-banner" role="status">
            Демонстрационный режим{' '}
            <span>Вымышленные гости и брони · внешние сервисы не вызываются</span>
          </div>
        )}
        {children}
      </div>
      <nav className="bottom-navigation" aria-label="Основная навигация">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={cx(activeNavigation(path)?.href === n.href && 'is-active')}
          >
            <Icon name={n.icon} />
            <span>{n.label}</span>
          </Link>
        ))}
        <button onClick={() => setMenu(true)} aria-label="Ещё разделы">
          <Icon name="more" />
          <span>Ещё</span>
        </button>
      </nav>
      <Overlay
        open={menu}
        onClose={() => setMenu(false)}
        title="Навигация"
        className="mobile-navigation"
      >
        <Sidebar
          property={property}
          path={path}
          close={() => setMenu(false)}
        />
      </Overlay>
      <GlobalSearch open={search} close={() => setSearch(false)} />
    </div>
  );
}
