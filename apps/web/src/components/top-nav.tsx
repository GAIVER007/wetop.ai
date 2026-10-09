'use client';
import { landingForVertical, type WebVertical } from '../lib/vertical-landing';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Suspense, use, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './icon';
import { Sidebar } from './shell/sidebar';
import { GrantedProperty, PropertyBlock, type PropertyIdentity } from './shell/property-block';
import { TopMenu } from './shell/top-menu';
import { GlobalSearch } from './shell/search';
import { Overlay } from './overlay';
import { useTheme } from './theme-provider';
import { cx } from './ui';
import {
  CLOSED_ACCESS,
  PENDING_ACCESS,
  activeItem,
  allowedItem,
  menuSectionsFor,
  phoneNavigationFor,
  type NavigationAccess,
} from '../lib/navigation';
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
  const router = useRouter();
  const shell = desk ? use(desk) : null;
  const scopeKey = shell?.scopeKey ?? 'unresolved';
  const [blockedScope, setBlockedScope] = useState<string | null>(null);
  const scopeSwitching = blockedScope === scopeKey;
  useEffect(() => {
    const begin = () => {
      setBlockedScope(scopeKey);
      setSearch(false);
      setMenu(false);
      setProfile(false);
    };
    const failed = () => setBlockedScope(null);
    window.addEventListener('wetop-scope-switch', begin);
    window.addEventListener('wetop-scope-switch-failed', failed);
    return () => {
      window.removeEventListener('wetop-scope-switch', begin);
      window.removeEventListener('wetop-scope-switch-failed', failed);
    };
  }, [scopeKey]);
  const beauty = shell?.vertical === 'BEAUTY';
  const food = shell?.vertical === 'FOOD_SERVICE';
  const hospitality = !scopeSwitching && !beauty && !food && !shell?.access.unknown;
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
        if (food) router.push('/table-reservations');
        else if (beauty) router.push('/appointments');
        else setSearch((s) => !s);
      }
      if (e.key === 'Escape') setProfile(false);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [path, beauty, food, router]);
  useEffect(() => {
    setProfile(false);
  }, [path]);
  if (path.includes('/print') || path === '/login' || path === '/register') return <>{children}</>;
  return (
    <DataFreshnessProvider enabled={hospitality}>
      <div className="workspace" data-scope-switching={scopeSwitching || undefined}>
        <a className="skip-link" href={scopeSwitching ? '#scope-switch-status' : '#main-content'}>
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
            <Link
              className="workspace-brand"
              href={landingForVertical(shell?.vertical ?? 'HOSPITALITY')}
              aria-label="WETOP, стартовый экран"
            >
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
              aria-label={
                food ? 'Найти бронирование' : beauty ? 'Найти запись' : 'Найти гостя или бронь'
              }
              onClick={() =>
                food
                  ? router.push('/table-reservations')
                  : beauty
                    ? router.push('/appointments')
                    : setSearch(true)
              }
            >
              <Icon name="search" />
              <span className="workspace-search-full">
                {food
                  ? 'Поиск бронирования или гостя'
                  : beauty
                    ? 'Поиск записи или клиента'
                    : 'Поиск гостя, брони, номера...'}
              </span>
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
                      {hospitality && (
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
                      )}
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
          <div className="workspace-content" hidden={scopeSwitching}>
            {children}
          </div>
          {scopeSwitching && (
            <main id="scope-switch-status" tabIndex={-1}>
              <h1>Сегодня</h1>
              <p role="status">Переключаем филиал…</p>
            </main>
          )}
        </div>
        {/* Нижняя панель телефона: первые четыре вкладки шапки (работа смены) и «Ещё» (ADR-050, ADR-134) */}
        <nav className="bottom-navigation" aria-label="Основная навигация">
          <Suspense fallback={<BottomNavLinks access={PENDING_ACCESS} path={path} />}>
            <GrantedBottomNav desk={desk} path={path} />
          </Suspense>
          <button
            onClick={() => setMenu(true)}
            aria-label="Ещё разделы"
            className={cx(moreActive(path, shell) && 'is-active')}
          >
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
        <Suspense fallback={null}>
          {hospitality && (
            <GrantedSearch desk={desk} open={search} close={() => setSearch(false)} />
          )}
        </Suspense>
        {/* Обучение (ADR-100): само — один раз на Главной, повтор — из меню профиля */}
        <Suspense fallback={null}>
          {hospitality && <ProductTour desk={desk} path={path} />}
        </Suspense>
      </div>
    </DataFreshnessProvider>
  );
}

/**
 * Нижняя панель телефона — первый раздел бокового меню, в том же порядке и с теми же подписями;
 * закрытые вошедшему пункты скрыты, как в самом меню (ADR-107). Пока ответа /auth/me нет —
 * PENDING_ACCESS, как у Sidebar: панель не мигает пустотой на каждом переходе.
 */
function BottomNavLinks({
  access,
  path,
  vertical,
}: {
  access: NavigationAccess;
  path: string;
  vertical?: WebVertical | undefined;
}) {
  // без ответа API панель гостиничная (`phoneNavigationFor`), подсветка тоже; своего правила у панели нет (DS2a)
  const active = activeItem(path, vertical ?? 'HOSPITALITY', access)?.href;
  return phoneNavigationFor(vertical)
    .filter((item) => allowedItem(item, access))
    .map((n) => (
      <Link
        key={n.href}
        href={n.href}
        // как в шапке и выдвижном меню: на /reservations активен пункт «Гости и бронирования», своего пункта у «Броней» нет (09.10.2026)
        className={cx(active === n.href && 'is-active')}
        aria-current={active === n.href ? 'page' : undefined}
      >
        <Icon name={n.icon} />
        <span>{n.shortLabel ?? n.label}</span>
      </Link>
    ));
}

/**
 * «Ещё» горит, когда активный пункт (DS2a, `activeItem`) живёт в меню за этой кнопкой, а не в панели. Раздел, которого
 * в меню ещё не видно (профиль гостиницы, «График» салона), кнопку не зажигает: за ней его не найти.
 */
function moreActive(path: string, shell: DeskShell | null): boolean {
  const access = shell?.access ?? CLOSED_ACCESS;
  const vertical = shell?.vertical ?? 'HOSPITALITY';
  const active = activeItem(path, vertical, access);
  if (!active) return false;
  if (phoneNavigationFor(vertical).some((item) => item.href === active.href && allowedItem(item, access)))
    return false;
  return menuSectionsFor(access, vertical).some((section) => section.id === active.sectionId);
}

function GrantedBottomNav({ desk, path }: { desk: Promise<DeskShell> | undefined; path: string }) {
  const shell = desk ? use(desk) : null;
  return (
    <BottomNavLinks
      access={shell?.access ?? CLOSED_ACCESS}
      path={path}
      vertical={shell?.vertical}
    />
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
      <strong>
        {shell.vertical === 'FOOD_SERVICE'
          ? 'Режим только для чтения'
          : 'Пробный период закончился, оплатите подписку.'}
      </strong>{' '}
      <span>
        {shell?.vertical !== 'HOSPITALITY'
          ? 'Данные доступны для просмотра. Для продления подписки обратитесь в поддержку WETOP.'
          : 'Данные доступны для просмотра, изменения после оплаты. Счёт и реквизиты выставит WETOP, напишите в чат помощника справа внизу.'}
      </span>
    </div>
  );
}
