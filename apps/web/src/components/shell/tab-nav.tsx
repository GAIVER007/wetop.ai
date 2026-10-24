'use client';
import Link from 'next/link';
import { Suspense, use, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import {
  CLOSED_ACCESS,
  activeMenuRoute,
  activeSectionOf,
  menuSectionsFor,
  type MenuSection,
} from '../../lib/navigation';
import type { DeskShell } from '../../lib/desk-person';
import { Icon } from '../icon';
import { cx } from '../ui';
import { translateSections } from '../../i18n';
import { useT } from '../../i18n/locale-provider';

/**
 * Строка разделов в шапке (решение владельца 17.10.2026, черновик `plans/top-nav-draft-2026-10-17.html`): значок над
 * подписью, у группы список подразделов по наведению и по нажатию. Тот же состав и те же права, что у выдвижного меню
 * (`menuSectionsFor`); видна от 1280 px, уже работает выдвижное меню (side-nav.css).
 */
export function TabNav({ path, desk }: { path: string; desk?: Promise<DeskShell> | undefined }) {
  return (
    <Suspense fallback={null}>
      <GrantedTabs path={path} desk={desk} />
    </Suspense>
  );
}

function GrantedTabs({ path, desk }: { path: string; desk: Promise<DeskShell> | undefined }) {
  const shell = desk ? use(desk) : null;
  const t = useT();
  return (
    <Tabs sections={translateSections(menuSectionsFor(shell?.access ?? CLOSED_ACCESS, shell?.vertical), t)} path={path} />
  );
}

function Tabs({ sections, path }: { sections: MenuSection[]; path: string }) {
  const t = useT();
  const active = activeMenuRoute(path);
  const current = activeSectionOf(sections, path)?.id;
  const [open, setOpenState] = useState<string>();
  // список висит поверх строки (`position: fixed`): строка прокручивается и обрезала бы его
  const setOpen = (sectionId: string | undefined) => {
    const trigger = sectionId
      ? root.current?.querySelector<HTMLElement>(`[aria-controls="${id}-${sectionId}"]`)
      : null;
    if (trigger)
      root.current?.style.setProperty('--tabnav-left', `${Math.max(0, trigger.getBoundingClientRect().left)}px`);
    setOpenState(sectionId);
  };
  const root = useRef<HTMLElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const id = useId();
  useEffect(() => setOpenState(undefined), [path]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpenState(undefined);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  useEffect(() => () => clearTimeout(leaveTimer.current), []);
  // наведение открывает список только у мыши: на сенсорном экране список открывает нажатие
  const hoverable = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const enter = (sectionId: string) => {
    clearTimeout(leaveTimer.current);
    if (hoverable()) setOpen(sectionId);
  };
  const leave = () => {
    clearTimeout(leaveTimer.current);
    if (hoverable()) leaveTimer.current = setTimeout(() => setOpen(undefined), 150);
  };
  const links = (sectionId: string) => [
    ...(root.current?.querySelectorAll<HTMLAnchorElement>(`#${CSS.escape(`${id}-${sectionId}`)} a`) ?? []),
  ];
  const onTriggerKey = (event: KeyboardEvent<HTMLButtonElement>, sectionId: string) => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    setOpen(sectionId);
    requestAnimationFrame(() => links(sectionId)[0]?.focus());
  };
  const onListKey = (event: KeyboardEvent<HTMLElement>, sectionId: string) => {
    const items = links(sectionId);
    const at = items.indexOf(document.activeElement as HTMLAnchorElement);
    const move: Record<string, number> = {
      ArrowDown: at + 1,
      ArrowUp: at - 1,
      Home: 0,
      End: items.length - 1,
    };
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(undefined);
      root.current?.querySelector<HTMLButtonElement>(`[aria-controls="${id}-${sectionId}"]`)?.focus();
      return;
    }
    if (move[event.key] === undefined) return;
    event.preventDefault();
    items[(move[event.key]! + items.length) % items.length]?.focus();
  };
  return (
    <nav
      ref={root}
      className="tabnav"
      aria-label={t('Главное меню')}
      onBlur={(event) => {
        if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget))
          setOpen(undefined);
      }}
    >
      {sections.map((section) => {
        const single = section.direct ? section.items[0] : undefined;
        const className = cx('tabnav__tab', section.id === current && 'is-current');
        const contents = (
          <>
            <Icon name={section.icon} />
            <span>{section.label}</span>
          </>
        );
        return (
          <div
            key={section.id}
            className="tabnav__group"
            onPointerEnter={() => !single && enter(section.id)}
            onPointerLeave={() => !single && leave()}
          >
            {single ? (
              <Link
                className={className}
                href={single.href}
                prefetch={false}
                aria-current={single.href === active ? 'page' : undefined}
              >
                {contents}
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  className={className}
                  aria-expanded={open === section.id}
                  aria-controls={`${id}-${section.id}`}
                  // мышью список уже открыт наведением: щелчок его не закрывает; на сенсоре щелчок переключает
                  onClick={() =>
                    setOpen(open === section.id && !hoverable() ? undefined : section.id)
                  }
                  onKeyDown={(event) => onTriggerKey(event, section.id)}
                >
                  {contents}
                </button>
                <div
                  id={`${id}-${section.id}`}
                  className="tabnav__list"
                  role="group"
                  aria-label={section.label}
                  hidden={open !== section.id}
                  onKeyDown={(event) => onListKey(event, section.id)}
                >
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={false}
                      className={cx('tabnav__link', item.href === active && 'is-active')}
                      aria-current={item.href === active ? 'page' : undefined}
                      onClick={() => setOpen(undefined)}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}
    </nav>
  );
}
