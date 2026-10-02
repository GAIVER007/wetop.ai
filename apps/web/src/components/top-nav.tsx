'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, use, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './icon';
import { Sidebar } from './shell/sidebar';
import { GrantedProperty, PropertyBlock, type PropertyIdentity } from './shell/property-block';
import { TopMenu } from './shell/top-menu';
import { GlobalSearch } from './shell/search';
import { Overlay } from './overlay';
import { useTheme } from './theme-provider';
import { cx } from './ui';
import { activeNavigation, phoneNavigation } from '../lib/navigation';
import type { DeskPerson, DeskShell } from '../lib/desk-person';
import { DataFreshnessProvider } from './data-freshness';
import { ProductTour } from './shell/product-tour';
import { TOUR_RESTART_EVENT } from './shell/tour-steps';

/**
 * Оболочка стойки (ADR-134): шапка из двух липких строк. Первая: знак WETOP, объект с переключателем
 * филиала, поиск ⌘K, «Демо», тема, меню профиля. Вторая: строка разделов (`TopMenu`). До 960 px вместо
 * строки разделов кнопка «Открыть меню» и окно «Навигация» (`Sidebar`), на телефоне ещё нижняя панель.
 */
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
  // Сочетание поиска словами той ОС, на которой человек сидит: ⌘ бывает только у Apple
  const [searchKey, setSearchKey] = useState('⌘ K');
  const { setTheme } = useTheme();
  useEffect(() => {
    if (!/Mac|iPhone|iPad/.test(navigator.platform)) setSearchKey('Ctrl K');
  }, []);
  // открыт ли общий поиск — для сочетания ниже, без пересоздания обработчика
  const searchOpen = useRef(false);
  useEffect(() => {
    searchOpen.current = search;
  }, [search]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && !path.includes('/print')) {
        e.preventDefault();
        // У страницы свой поиск (шахматка, ТЗ «Шахматка v2» §40) — сочетание ставит курсор в него;
        // курсор уже там — открывается общий поиск
        const local = document.querySelector<HTMLInputElement>('[data-page-search]');
        if (
          !searchOpen.current &&
          local &&
          local.offsetParent !== null &&
          document.activeElement !== local
        ) {
          local.focus();
          local.select();
          return;
        }
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
  return (
    <DataFreshnessProvider>
      <div className="workspace">
        <a className="skip-link" href="#main-content">
          К содержимому
        </a>
        <header className="workspace-header">
          <div className="workspace-header__row">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMenu(true)}
              aria-label="Открыть меню"
            >
              <Icon name="menu" />
            </button>
            <Link className="workspace-brand" href="/today" aria-label="WETOP, Главная">
              <span className="workspace-mark">W</span>
              <span className="brand-name">
                WETOP<span>.AI</span>
              </span>
            </Link>
            {/* объект и филиал: переехали сюда из бокового меню (ADR-134); до 960 px они вверху меню телефона */}
            <div className="workspace-header__property">
              <Suspense
                fallback={<PropertyBlock property={property} settings={false} close={undefined} />}
              >
                <GrantedProperty desk={desk} property={property} close={undefined} path={path} />
              </Suspense>
            </div>
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
                  {/* имя и роль словом (ADR-083): объект теперь стоит рядом со знаком, роль иначе негде увидеть */}
                  <span className="profile-caption">
                    <Suspense fallback={<HeaderCaption person={null} />}>
                      <GrantedHeaderCaption desk={desk} />
                    </Suspense>
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
                      <button
                        data-testid="tour-restart"
                        onClick={() => {
                          setProfile(false);
                          window.dispatchEvent(new Event(TOUR_RESTART_EVENT));
                        }}
                      >
                        <Icon name="help" />
                        Обучение работе в WETOP
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
          </div>
          <TopMenu path={path} desk={desk} />
        </header>
        <div className="workspace-body">
          <Suspense fallback={null}>
            <GrantedReadOnly desk={desk} />
          </Suspense>
          {demo && (
            <div className="demo-banner" role="status">
              Демонстрационный режим{' '}
              <span>Вымышленные гости и брони · внешние сервисы не вызываются</span>
            </div>
          )}
          {children}
        </div>
        {/* Нижняя панель телефона: первые четыре вкладки шапки (работа смены) и «Ещё» (ADR-050, ADR-134) */}
        <nav className="bottom-navigation" aria-label="Основная навигация">
          {phoneNavigation.map((n) => (
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

function GrantedHeaderCaption({ desk }: { desk: Promise<DeskShell> | undefined }) {
  const shell = desk ? use(desk) : null;
  return <HeaderCaption person={shell?.person ?? null} />;
}

/** Имя и роль словом; вошедшего нет — прежняя «Администратор» */
function HeaderCaption({ person }: { person: DeskPerson | null }) {
  return (
    <>
      <strong>{person?.name ?? 'Администратор'}</strong>
      <small>{person?.caption ?? 'Рабочее пространство'}</small>
    </>
  );
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

/**
 * Полоса «только чтение» (Q-144 — Б, ADR-102): пробный срок вышел или организация ждёт оплаты. Видна на каждом экране;
 * данные читаются, а изменения API отклоняет теми же словами.
 */
function GrantedReadOnly({ desk }: { desk: Promise<DeskShell> | undefined }) {
  const shell = desk ? use(desk) : null;
  if (!shell?.readOnly) return null;
  return (
    <div className="read-only-banner" role="status" data-testid="read-only-banner">
      <strong>Пробный период закончился — оплатите подписку.</strong>{' '}
      <span>
        Данные доступны для просмотра, изменения — после оплаты. Счёт и реквизиты выставит WETOP — напишите в чат
        помощника справа внизу.
      </span>
    </div>
  );
}
