'use client';
import { landingForVertical } from '../lib/vertical-landing';
import { PENDING_ACCESS, allowedItem, routeRule } from '../lib/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, use, useEffect, useRef, useState, type ReactNode, type MouseEvent } from 'react';
import { Icon } from './icon';
import { Sidebar } from './shell/sidebar';
import { GrantedProperty, PropertyBlock, type PropertyIdentity } from './shell/property-block';
import { SideNav } from './shell/side-nav';
import { TabNav } from './shell/tab-nav';
import { GlobalSearch } from './shell/search';
import styles from './top-nav.module.css';
import { Overlay } from './overlay';
import { useTheme } from './theme-provider';
import type { DeskPerson, DeskShell } from '../lib/desk-person';
import { DataFreshness, DataFreshnessProvider } from './data-freshness';
import { ProductTour } from './shell/product-tour';
import { TOUR_RESTART_EVENT } from './shell/tour-steps';
import { WhatsNewLink } from './shell/whats-new-link';

/** UI3.1: одна строка шапки, скрытое меню и отдельная мобильная поверхность. */
export function TopNav({
  children,
  demo = false,
  property = null,
  account = null,
  desk,
  support = false,
}: {
  children: ReactNode;
  demo?: boolean;
  property?: PropertyIdentity | null;
  /** «Кто на смене» и «Выйти» — серверный кусок, см. components/shell/account-menu.tsx */
  account?: ReactNode;
  /** Кто вошёл и что ему открыто (ADR-083) — из `lib/desk-shell.ts`; макет его не ждёт */
  desk?: Promise<DeskShell>;
  /** Заданы ли контакты поддержки (SUP1): без них пункта «Связаться с поддержкой» нет */
  support?: boolean;
}) {
  const path = usePathname() ?? '';
  const menuDestination = useRef<string | null>(null);
  const cancelMenuFocus = useRef<(() => void) | null>(null);
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
  const profileTrigger = useRef<HTMLButtonElement>(null);
  const profileMenu = useRef<HTMLDivElement>(null);
  const moveInProfile = (key: string) => {
    const items = [...(profileMenu.current?.querySelectorAll<HTMLElement>('a, button') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next =
      key === 'Home' ? 0 : key === 'End' ? items.length - 1 : key === 'ArrowUp' ? at - 1 : at + 1;
    items[(next + items.length) % items.length]?.focus();
  };
  // Шапку рисует сервер, а обработчик меню профиля навешивает React после загрузки скриптов стойки: на
  // медленной сети между ними секунды, кнопка в это время выглядит рабочей, а клик по ней пропадает
  // (release-checks #7, спек profile-menu-readiness). До первого рендера на клиенте кнопка недоступна и
  // помечена занятой; разметка сервера и первого клиентского рендера одна, расхождения гидрации нет
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
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
        // один быстрый поиск у всех направлений (аудит платформы 17.10.2026, Д3)
        setSearch((s) => !s);
      }
      if (e.key === 'Escape' && profileMenu.current) {
        setProfile(false);
        profileTrigger.current?.focus();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [path]);
  useEffect(() => {
    setProfile(false);
    setMenu(false);
    const focusRequested = menuDestination.current === path;
    menuDestination.current = null;
    if (focusRequested) cancelMenuFocus.current = focusMainWhenReady();
    return () => cancelMenuFocus.current?.();
  }, [path]);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 960px)');
    const cancelFocus = () => {
      menuDestination.current = null;
      cancelMenuFocus.current?.();
    };
    const close = () => {
      setMenu(false);
      cancelFocus();
    };
    media.addEventListener('change', close);
    window.addEventListener('popstate', close);
    window.addEventListener('pointerdown', cancelFocus);
    window.addEventListener('keydown', cancelFocus);
    return () => {
      media.removeEventListener('change', close);
      window.removeEventListener('popstate', close);
      window.removeEventListener('pointerdown', cancelFocus);
      window.removeEventListener('keydown', cancelFocus);
      cancelFocus();
    };
  }, []);
  const onMenuNavigation = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    const link =
      event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
    if (!link?.closest('.sidenav__panel, .mobile-navigation') || link.target === '_blank') return;
    const url = new URL(link.href);
    if (url.origin !== window.location.origin) return;
    cancelMenuFocus.current?.();
    if (url.pathname === path) cancelMenuFocus.current = focusMainWhenReady();
    else menuDestination.current = url.pathname;
  };
  if (path.includes('/print') || path === '/login' || path === '/register') return <>{children}</>;
  return (
    <DataFreshnessProvider enabled={hospitality}>
      <div
        className="workspace"
        data-scope-switching={scopeSwitching || undefined}
        onClickCapture={onMenuNavigation}
      >
        <header
          className={`workspace-header ${path === '/chessboard' ? styles.calendarHeader : ''}`}
        >
          <a className="skip-link" href={scopeSwitching ? '#scope-switch-status' : '#main-content'}>
            К содержимому
          </a>
          <div className="workspace-header__row">
            <button
              className="icon-button mobile-menu"
              onClick={() => {
                setProfile(false);
                setSearch(false);
                setMenu(true);
              }}
              disabled={!ready}
              aria-expanded={menu}
              aria-label="Открыть меню"
            >
              <Icon name="menu" />
            </button>
            <SideNav
              path={path}
              desk={desk}
              dismissKey={`${scopeKey}:${scopeSwitching}:${search}:${profile}:${menu}`}
            />
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

            {/* строка разделов (решение владельца 17.10.2026): от 1280 px, уже выдвижное меню слева */}
            <TabNav path={path} desk={desk} />
            {path !== '/chessboard' && (
              <button
                className="workspace-search"
                data-tour="search"
                aria-label={beauty || food ? 'Найти клиента или раздел' : 'Найти гостя или бронь'}
                onClick={() => setSearch(true)}
              >
                <Icon name="search" />
                <span className="workspace-search-full">
                  {beauty || food ? 'Поиск клиента, раздела...' : 'Поиск гостя, брони, номера...'}
                </span>
                <span className="workspace-search-short" aria-hidden="true">
                  Поиск
                </span>
                <kbd>{searchKey}</kbd>
              </button>
            )}
            {/* филиал справа, рядом с профилем (верхнее меню 17.10.2026); до 960 px он вверху меню телефона */}
            <div className="workspace-header__property">
              <Suspense
                fallback={<PropertyBlock property={property} settings={false} close={undefined} />}
              >
                <GrantedProperty desk={desk} property={property} close={undefined} path={path} />
              </Suspense>
            </div>
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
                  ref={profileTrigger}
                  className="profile-trigger"
                  data-tour="profile"
                  aria-label="Меню администратора"
                  aria-expanded={profile}
                  aria-controls="profile-dropdown"
                  aria-busy={!ready}
                  disabled={!ready}
                  onClick={() => setProfile(!profile)}
                  onKeyDown={(event) => {
                    if (event.key !== 'ArrowDown') return;
                    event.preventDefault();
                    setProfile(true);
                    requestAnimationFrame(() => moveInProfile('Home'));
                  }}
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
                    <div
                      className="profile-dropdown"
                      id="profile-dropdown"
                      ref={profileMenu}
                      onKeyDown={(event) => {
                        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
                        event.preventDefault();
                        moveInProfile(event.key);
                      }}
                    >
                      {/* одинаково у трёх направлений (аудит платформы 17.10.2026, Д4): раньше у гостиницы
                          не было пути к профилю, помощи и филиалам на компьютере, а салону и ресторану
                          «Помощь» и «Профиль» стояли отдельными пунктами меню */}
                      <Link href="/profile" onClick={() => setProfile(false)}>
                        <Icon name="person" />
                        Профиль
                      </Link>
                      {/* «Моя работа» (личный экран сотрудника) здесь, не в разделах (17.10.2026) */}
                      {(beauty || food) && (
                        <Link href="/my-work" onClick={() => setProfile(false)}>
                          <Icon name="person" />
                          Моя работа
                        </Link>
                      )}
                      {allowedItem(routeRule('/branches') ?? {}, shell?.access ?? PENDING_ACCESS) && (
                        <Link href="/branches" onClick={() => setProfile(false)}>
                          <Icon name="hotel" />
                          Филиалы
                        </Link>
                      )}
                      <hr className="profile-dropdown__sep" />
                      <Link href="/help" onClick={() => setProfile(false)}>
                        <Icon name="help" />
                        Помощь
                      </Link>
                      {support && (
                        <Link href="/help#support" onClick={() => setProfile(false)}>
                          <Icon name="chat" />
                          Связаться с поддержкой
                        </Link>
                      )}
                      <WhatsNewLink vertical={shell?.vertical ?? 'HOSPITALITY'} onClick={() => setProfile(false)} />
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
                      <hr className="profile-dropdown__sep" />
                      {/* пробный период и свежесть данных: на широком экране панели ☰ нет (18.10.2026), строки здесь */}
                      {shell?.trial && (
                        <span className="profile-dropdown__note" data-testid="profile-trial">
                          <Icon name="clock" />
                          {shell.trial}
                        </span>
                      )}
                      <span className="profile-dropdown__note profile-dropdown__note--status">
                        <DataFreshness />
                      </span>
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
        <Overlay
          open={menu}
          trapFocus
          onClose={() => setMenu(false)}
          title="Навигация"
          className="mobile-navigation"
        >
          <Sidebar property={property} path={path} close={() => setMenu(false)} desk={desk} />
        </Overlay>
        <Suspense fallback={null}>
          {!scopeSwitching && !shell?.access.unknown && (
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

/** Focus only the completed route, then detach; user interaction cancels this from TopNav. */
function focusMainWhenReady(): () => void {
  const content = document.querySelector('.workspace-content');
  if (!content) return () => undefined;
  let frame = 0;
  let stopped = false;
  const stop = () => {
    stopped = true;
    observer.disconnect();
    cancelAnimationFrame(frame);
  };
  const focus = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (stopped) return;
      const main = document.getElementById('main-content');
      if (!main?.getClientRects().length || main.getAttribute('aria-busy') === 'true') return;
      const loading = [
        ...main.querySelectorAll<HTMLElement>('.loading-state[aria-busy="true"]'),
      ].some((element) => element.getClientRects().length > 0);
      if (loading) return;
      main.focus({ preventScroll: true });
      stop();
    });
  };
  const observer = new MutationObserver(focus);
  observer.observe(content, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-busy', 'hidden', 'class'],
  });
  focus();
  return stop;
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
      {/* полное имя и роль в подсказке: в узкой шапке строка обрезается многоточием (аудит 21.10.2026 п. 23) */}
      <strong title={person?.name ?? undefined}>{person?.name ?? 'Администратор'}</strong>
      <small title={person?.caption ?? undefined}>{person?.caption ?? 'Рабочее пространство'}</small>
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
  return <GlobalSearch {...props} access={shell?.access} vertical={shell?.vertical} />;
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
