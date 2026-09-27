'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, use, useEffect, useState, type ReactNode } from 'react';
import { Icon } from './icon';
import { Sidebar, type PropertyIdentity } from './shell/sidebar';
import { GlobalSearch } from './shell/search';
import { Overlay } from './overlay';
import { useTheme } from './theme-provider';
import { cx } from './ui';
import { activeNavigation, sidebarSections } from '../lib/navigation';
import type { DeskPerson, DeskShell } from '../lib/desk-person';
import { DataFreshnessProvider } from './data-freshness';
import { ProductTour } from './shell/product-tour';
import { TOUR_RESTART_EVENT } from './shell/tour-steps';
export function TopNav({
  children,
  demo = false,
  property = null,
  account = null,
  desk,
}: {
  children: ReactNode;
  demo?: boolean;
  property?: PropertyIdentity | null;
  /** «Кто на смене» и «Выйти» — серверный кусок, см. components/shell/account-menu.tsx */
  account?: ReactNode;
  /** Кто вошёл и что ему открыто (ADR-083) — из `lib/desk-shell.ts`; макет его не ждёт */
  desk?: Promise<DeskShell>;
}) {
  const path = usePathname() ?? '';
  const [search, setSearch] = useState(false);
  const [menu, setMenu] = useState(false);
  const [profile, setProfile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  // Сочетание поиска словами той ОС, на которой человек сидит: ⌘ бывает только у Apple
  const [searchKey, setSearchKey] = useState('⌘ K');
  const { setTheme } = useTheme();
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('wetop.sidebar') === 'collapsed');
    } catch {
      /* Optional preference. */
    }
    if (!/Mac|iPhone|iPad/.test(navigator.platform)) setSearchKey('Ctrl K');
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
  // Нижняя панель телефона — первый раздел бокового меню, в том же порядке и с теми же подписями
  const nav = sidebarSections[0]!.items;
  return (
    <DataFreshnessProvider>
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
            desk={desk}
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
              data-tour="search"
              aria-label="Найти гостя или бронь"
              onClick={() => setSearch(true)}
            >
              <Icon name="search" />
              <span className="workspace-search-full">Поиск гостя, брони, номера...</span>
              <span className="workspace-search-short" aria-hidden="true">
                Поиск
              </span>
              <kbd>{searchKey}</kbd>
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
                  data-tour="profile"
                  aria-label="Меню администратора"
                  aria-expanded={profile}
                  aria-controls="profile-dropdown"
                  onClick={() => setProfile(!profile)}
                >
                  <Suspense fallback={<HeaderPerson person={null} />}>
                    <GrantedHeaderPerson desk={desk} />
                  </Suspense>
                  <span className="profile-caption">
                    <Suspense fallback={<strong>Администратор</strong>}>
                      <GrantedHeaderName desk={desk} />
                    </Suspense>
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
                      <button
                        data-testid="tour-restart"
                        onClick={() => {
                          setProfile(false);
                          window.dispatchEvent(new Event(TOUR_RESTART_EVENT));
                        }}
                      >
                        <Icon name="help" />
                        Обучение: как устроена стойка
                      </button>
                      {account ?? (
                        <Link href="/login">
                          <Icon name="departure" />
                          Экран входа
                        </Link>
                      )}
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
          <Sidebar property={property} path={path} close={() => setMenu(false)} desk={desk} />
        </Overlay>
        <Suspense fallback={<GlobalSearch open={search} close={() => setSearch(false)} />}>
          <GrantedSearch desk={desk} open={search} close={() => setSearch(false)} />
        </Suspense>
        {/* Обучение (ADR-100): само — один раз на Главной, повтор — из меню профиля */}
        <Suspense fallback={null}>
          <ProductTour desk={desk} path={path} />
        </Suspense>
      </div>
    </DataFreshnessProvider>
  );
}

function GrantedHeaderPerson({ desk }: { desk: Promise<DeskShell> | undefined }) {
  const shell = desk ? use(desk) : null;
  return <HeaderPerson person={shell?.person ?? null} />;
}

function HeaderPerson({ person }: { person: DeskPerson | null }) {
  return <span className="desk-avatar">{person?.initials ?? 'АД'}</span>;
}

function GrantedHeaderName({ desk }: { desk: Promise<DeskShell> | undefined }) {
  const shell = desk ? use(desk) : null;
  return <strong>{shell?.person?.name ?? 'Администратор'}</strong>;
}

/** Поиск по разделам — только по открытым вошедшему, как и меню */
function GrantedSearch({
  desk,
  ...props
}: {
  desk: Promise<DeskShell> | undefined;
  open: boolean;
  close: () => void;
}) {
  const shell = desk ? use(desk) : null;
  return <GlobalSearch {...props} access={shell?.access} />;
}
