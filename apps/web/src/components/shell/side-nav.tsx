'use client';
import Link from 'next/link';
import { Suspense, use, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { flushSync } from 'react-dom';
import {
  CLOSED_ACCESS,
  activeMenuRoute,
  currentPlace,
  menuSectionsFor,
  type MenuSection,
} from '../../lib/navigation';
import type { DeskShell } from '../../lib/desk-person';
import { DataFreshness } from '../data-freshness';
import { Icon } from '../icon';
import { cx } from '../ui';

/** UI3.1: one trigger, shared access registry, no persistent navigation column. */
export function SideNav({
  path,
  desk,
  dismissKey,
}: {
  path: string;
  desk?: Promise<DeskShell> | undefined;
  dismissKey: string;
}) {
  return (
    <aside className="sidenav">
      <Suspense fallback={null}>
        <GrantedMenu desk={desk} path={path} dismissKey={dismissKey} />
      </Suspense>
    </aside>
  );
}

function GrantedMenu({
  desk,
  path,
  dismissKey,
}: {
  desk: Promise<DeskShell> | undefined;
  path: string;
  dismissKey: string;
}) {
  const shell = desk ? use(desk) : null;
  return (
    <Menu
      sections={menuSectionsFor(shell?.access ?? CLOSED_ACCESS, shell?.vertical)}
      path={path}
      dismissKey={dismissKey}
      trial={shell?.trial ?? null}
    />
  );
}

function Menu({
  sections,
  path,
  dismissKey,
  trial,
}: {
  sections: MenuSection[];
  path: string;
  dismissKey: string;
  trial: string | null;
}) {
  const active = activeMenuRoute(path);
  const place = currentPlace(sections, path);
  const current = place.section;
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<string>();
  const root = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const shown = sections.find((s) => s.id === hovered) ?? current ?? sections[0];
  useEffect(() => setReady(true), []);
  useEffect(() => {
    setOpen(false);
  }, [path, dismissKey]);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 960px)');
    const close = () => setOpen(false);
    media.addEventListener('change', close);
    window.addEventListener('popstate', close);
    return () => {
      media.removeEventListener('change', close);
      window.removeEventListener('popstate', close);
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  const controls = (column: Element | null | undefined) =>
    [...(column?.querySelectorAll<HTMLElement>('a, button') ?? [])].filter(
      (el) => el.getClientRects().length,
    );
  const focusIn = (column: string, index = 0) =>
    controls(root.current?.querySelector(`[data-column="${column}"]`))[index]?.focus();
  const show = () => {
    flushSync(() => {
      setHovered(current?.id);
      setOpen(true);
    });
    focusIn(
      'sections',
      Math.max(
        0,
        sections.findIndex((s) => s.id === current?.id),
      ),
    );
  };
  const navigate = () => setOpen(false);
  const onPanelKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
      return;
    }
    const target = event.target as HTMLElement;
    const column = target.closest<HTMLElement>('[data-column]');
    if (!column) return;
    const items = controls(column);
    const index = items.indexOf(target);
    const actions: Record<string, () => void> = {
      ArrowDown: () => items[(index + 1) % items.length]?.focus(),
      ArrowUp: () => items[(index - 1 + items.length) % items.length]?.focus(),
      Home: () => items[0]?.focus(),
      End: () => items.at(-1)?.focus(),
      ArrowRight: () => column.dataset.column === 'sections' && focusIn('items'),
      ArrowLeft: () =>
        column.dataset.column === 'items' &&
        focusIn(
          'sections',
          Math.max(
            0,
            sections.findIndex((s) => s.id === shown?.id),
          ),
        ),
    };
    if (actions[event.key]) {
      event.preventDefault();
      actions[event.key]!();
    }
  };
  return (
    <nav
      ref={root}
      className="sidenav__nav"
      aria-label="Разделы"
      onKeyDown={onPanelKey}
      onBlur={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="sidenav__current"
        aria-label="Открыть меню"
        title={place.label}
        aria-expanded={open}
        aria-controls={id}
        disabled={!ready}
        aria-busy={!ready}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            show();
          }
        }}
      >
        <Icon name="menu" />
        <span className="sr-only">{place.label}</span>
      </button>
      <div id={id} className="sidenav__panel" hidden={!open} data-open={open || undefined}>
        <div className="sidenav__sections" data-column="sections">
          {sections.map((section) => {
            const single = section.direct ? section.items[0] : undefined;
            const contents = (
              <>
                <Icon name={section.icon} />
                <span>{section.label}</span>
                {!single && <Icon name="chevron" className="sidenav__more" />}
              </>
            );
            const props = {
              className: cx(
                'sidenav__section',
                section.id === shown?.id && 'is-shown',
                section.id === current?.id && 'has-current-page',
              ),
              'data-tour': `section-${section.id}`,
              onPointerEnter: () => setHovered(section.id),
              onFocus: () => setHovered(section.id),
            };
            return single ? (
              <Link
                key={section.id}
                {...props}
                href={single.href}
                prefetch={false}
                aria-current={single.href === active ? 'page' : undefined}
                onClick={navigate}
              >
                {contents}
              </Link>
            ) : (
              <button
                key={section.id}
                {...props}
                type="button"
                aria-expanded={shown?.id === section.id}
                aria-controls={`${id}-${section.id}`}
                onClick={() => setHovered(section.id)}
              >
                {contents}
              </button>
            );
          })}
        </div>
        <div className="sidenav__items" data-column="items" role="group" aria-label="Подразделы">
          {shown?.direct && (
            <div>
              <p className="sidenav__title">{shown.label}</p>
              <p className="sidenav__hint">{shown.items[0]?.description}</p>
            </div>
          )}
          {sections.map((section) => (
            <div
              key={section.id}
              id={`${id}-${section.id}`}
              hidden={section.id !== shown?.id || !!section.direct}
            >
              <p className="sidenav__title">{section.label}</p>
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  className={cx('sidenav__link', item.href === active && 'is-active')}
                  aria-current={!section.direct && item.href === active ? 'page' : undefined}
                  onClick={navigate}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="sidenav__bottom">
          {trial && (
            <span className="sidenav__trial" data-testid="trial-line" data-tour="trial">
              <Icon name="clock" />
              <span>{trial}</span>
            </span>
          )}
          <DataFreshness />
        </div>
      </div>
    </nav>
  );
}
