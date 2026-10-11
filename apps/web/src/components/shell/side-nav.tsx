'use client';
import Link from 'next/link';
import { Suspense, use, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { flushSync } from 'react-dom';
import { CLOSED_ACCESS, activeMenuRoute, menuSectionsFor, type MenuSection } from '../../lib/navigation';
import type { DeskShell } from '../../lib/desk-person';
import { landingForVertical } from '../../lib/vertical-landing';
import { DataFreshness } from '../data-freshness';
import { Icon } from '../icon';
import { cx } from '../ui';

/**
 * Левая контекстная навигация (ТЗ «Новая навигация админки», поручение владельца 10.10.2026, ADR-161).
 * Видна только кнопка текущего раздела и его подразделы. Наведение или щелчок по кнопке открывает панель:
 * слева все разделы, справа подразделы того, на который наведён курсор. Щелчок по пункту ведёт на страницу,
 * панель закрывается, меню слева показывает новый раздел. Состав и права из `menuSectionsFor` (ADR-107).
 * До 960 px меню нет: окно «Навигация» (`Sidebar`) и нижняя панель телефона.
 */
export function SideNav({ path, desk }: { path: string; desk?: Promise<DeskShell> | undefined }) {
  return (
    <aside className="sidenav">
      <Suspense fallback={<Brand href="/" />}>
        <GrantedBrand desk={desk} />
      </Suspense>
      {/* пока API не ответил, меню пустое: разделы появляются, а не исчезают (ADR-107) */}
      <Suspense fallback={null}>
        <GrantedMenu desk={desk} path={path} />
      </Suspense>
      <div className="sidenav__bottom">
        <Suspense fallback={null}>
          <GrantedTrial desk={desk} />
        </Suspense>
        {/* Свежесть данных Channex и очереди ARI: общий опрос оболочки, своего запроса нет */}
        <span className="sidenav__freshness">
          <DataFreshness />
        </span>
      </div>
    </aside>
  );
}

function GrantedBrand({ desk }: { desk: Promise<DeskShell> | undefined }) {
  const shell = desk ? use(desk) : null;
  return <Brand href={landingForVertical(shell?.vertical ?? 'HOSPITALITY')} />;
}

function Brand({ href }: { href: string }) {
  return (
    <Link className="workspace-brand sidenav__brand" href={href} aria-label="WETOP, стартовый экран">
      <span className="workspace-mark">W</span>
      <span className="brand-name">
        WETOP<span>.AI</span>
      </span>
    </Link>
  );
}

function GrantedMenu({ desk, path }: { desk: Promise<DeskShell> | undefined; path: string }) {
  const shell = desk ? use(desk) : null;
  return (
    <Menu sections={menuSectionsFor(shell?.access ?? CLOSED_ACCESS, shell?.vertical)} path={path} />
  );
}

/** Задержка закрытия: курсор успевает дойти от кнопки до панели, ТЗ §6 «закрывается при уходе курсора» */
const CLOSE_DELAY = 150;

function Menu({ sections, path }: { sections: MenuSection[]; path: string }) {
  const active = activeMenuRoute(path);
  const current = sections.find((section) => section.items.some((item) => item.href === active));
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<string | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const shown = sections.find((s) => s.id === hovered) ?? current ?? sections[0];

  const show = () => {
    clearTimeout(timer.current);
    if (!open) setHovered(current?.id);
    setOpen(true);
  };
  const hide = (delay = 0) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), delay);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  // Панель уже в разметке (flushSync ниже), поэтому фокус ставится сразу, без кадра анимации:
  // requestAnimationFrame в фоновой вкладке не срабатывает
  const linksOf = (column: Element | null | undefined) =>
    [...(column?.querySelectorAll<HTMLElement>('a') ?? [])].filter((a) => a.getClientRects().length);
  const focusIn = (column: 'sections' | 'items', index = 0) =>
    linksOf(root.current?.querySelector(`[data-column="${column}"]`))[index]?.focus();

  // Клавиатура (ТЗ §9): ↑↓ по столбцу, → в подразделы, ← обратно к разделу, Escape закрывает
  const onPanelKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const column = target.closest<HTMLElement>('[data-column]');
    if (!column) return;
    const links = linksOf(column);
    const index = links.indexOf(target);
    const move: Record<string, () => void> = {
      ArrowDown: () => links[(index + 1) % links.length]?.focus(),
      ArrowUp: () => links[(index - 1 + links.length) % links.length]?.focus(),
      Home: () => links[0]?.focus(),
      End: () => links.at(-1)?.focus(),
      ArrowRight: () => column.dataset.column === 'sections' && focusIn('items'),
      ArrowLeft: () =>
        column.dataset.column === 'items' &&
        focusIn('sections', Math.max(0, sections.findIndex((s) => s.id === shown?.id))),
      Escape: () => {
        setOpen(false);
        trigger.current?.focus();
      },
    };
    const action = move[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  const panelId = `${id}-panel`;
  return (
    <nav className="sidenav__nav" aria-label="Разделы">
      <div
        className="sidenav__menu"
        ref={root}
        onPointerEnter={(event) => event.pointerType === 'mouse' && show()}
        onPointerLeave={(event) => event.pointerType === 'mouse' && hide(CLOSE_DELAY)}
        onBlur={(event) => {
          if (!(event.relatedTarget instanceof Node) || !root.current?.contains(event.relatedTarget))
            hide();
        }}
      >
        <button
          ref={trigger}
          type="button"
          className="sidenav__current"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`${current?.label ?? 'Разделы'}: все разделы`}
          onClick={() => (open ? hide() : show())}
          onKeyDown={(event) => {
            if (event.key === 'Escape') return hide();
            if (event.key !== 'ArrowDown') return;
            event.preventDefault();
            flushSync(show);
            focusIn('sections', Math.max(0, sections.findIndex((s) => s.id === current?.id)));
          }}
        >
          <Icon name={current?.icon ?? 'menu'} />
          <span>{current?.label ?? 'Разделы'}</span>
          <Icon className="sidenav__chevron" name="down" width={16} />
        </button>
        <div
          id={panelId}
          className="sidenav__panel"
          data-open={open || undefined}
          onKeyDown={onPanelKey}
        >
          <div className="sidenav__sections" data-column="sections">
            {sections.map((section) => (
              <Link
                key={section.id}
                href={section.items[0]!.href}
                prefetch={false}
                data-tour={`section-${section.id}`}
                className={cx(
                  'sidenav__section',
                  section.id === shown?.id && 'is-shown',
                  section.id === current?.id && 'has-current-page',
                )}
                aria-current={section.id === current?.id ? 'true' : undefined}
                onPointerEnter={() => setHovered(section.id)}
                onFocus={() => setHovered(section.id)}
                onClick={() => setOpen(false)}
              >
                <Icon name={section.icon} />
                <span>{section.label}</span>
                {!section.direct && <Icon className="sidenav__more" name="chevron" width={14} />}
              </Link>
            ))}
          </div>
          {/* подразделы всех разделов в разметке, виден один: каждый адрес меню ровно один раз (`hidden`) */}
          <div className="sidenav__items" data-column="items">
            {sections.map((section) => (
              <div key={section.id} hidden={section.id !== shown?.id}>
                <p className="sidenav__title">
                  <Icon name={section.icon} />
                  <span>{section.label}</span>
                </p>
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    className={cx('sidenav__link', item.href === active && 'is-active')}
                    aria-current={item.href === active ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                  >
                    <Icon name={item.icon} />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* После перехода раздел раскрыт в самом меню: его подразделы под кнопкой (макет, «после клика») */}
      {current && !current.direct && (
        <div className="sidenav__sub">
          {current.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={cx('sidenav__link', item.href === active && 'is-active')}
              aria-current={item.href === active ? 'page' : undefined}
            >
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}

/** Пробный период организации: на каждом экране, а не только на `/login` (ТЗ ux-retention п. 2.7) */
function GrantedTrial({ desk }: { desk: Promise<DeskShell> | undefined }) {
  const trial = desk ? use(desk).trial : null;
  if (!trial) return null;
  return (
    <span className="sidenav__trial" data-testid="trial-line" data-tour="trial">
      <Icon name="clock" width={16} />
      <span>{trial}</span>
    </span>
  );
}
