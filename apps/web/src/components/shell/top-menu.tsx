'use client';
import Link from 'next/link';
import { Suspense, use, useEffect, useId, useRef, useState } from 'react';
import {
  CLOSED_ACCESS,
  activeItem,
  menuSectionsFor,
  type ActiveItem,
  type MenuSection,
} from '../../lib/navigation';
import type { DeskShell } from '../../lib/desk-person';
import { DataFreshness } from '../data-freshness';
import { Icon } from '../icon';
import { cx } from '../ui';

/**
 * Строка разделов в шапке (ADR-134, plans/workspace-top-navigation-2026-10-02.md): вкладки по задачам,
 * активная подчёркнута; группа с несколькими экранами раскрывает список под вкладкой. Открытый список
 * один; Escape закрывает его и возвращает фокус на вкладку, щелчок мимо, уход фокуса и переход закрывают.
 * Список всегда в разметке (`hidden`), поэтому текущий пункт помечен `aria-current` и при закрытом списке.
 * Справа строка пробного срока и свежесть Channex. До 960 px строки нет: меню телефона (`Sidebar`).
 */
export function TopMenu({
  path,
  desk,
}: {
  path: string;
  /** Что открыто вошедшему (ADR-083): меню получает обещание и не задерживает страницу */
  desk?: Promise<DeskShell> | undefined;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const root = useRef<HTMLElement>(null);
  const id = useId();
  useEffect(() => {
    setOpen(null);
  }, [path]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(null);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  const tabs: TabsProps = { id, path, open, setOpen };
  return (
    <nav
      className="topmenu"
      aria-label="Разделы"
      ref={root}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return;
        const button = root.current?.querySelector<HTMLElement>(
          `[aria-controls="${CSS.escape(`${id}-${open}`)}"]`,
        );
        setOpen(null);
        button?.focus();
      }}
      onBlur={(event) => {
        if (
          open &&
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          setOpen(null);
      }}
    >
      <div className="topmenu__tabs">
        {/* пока API не ответил — вкладки как у администратора: они появляются, а не исчезают (ADR-107) */}
        <Suspense fallback={null}>
          <GrantedTabs desk={desk} {...tabs} />
        </Suspense>
      </div>
      <div className="topmenu__aside">
        <Suspense fallback={null}>
          <GrantedTrial desk={desk} />
        </Suspense>
        {/* Свежесть данных Channex и очереди ARI: общий опрос оболочки, своего запроса нет */}
        <span className="topmenu__freshness">
          <DataFreshness />
        </span>
      </div>
    </nav>
  );
}

interface TabsProps {
  id: string;
  path: string;
  open: string | null;
  setOpen: (value: string | null) => void;
}

function GrantedTabs({ desk, path, ...props }: TabsProps & { desk: Promise<DeskShell> | undefined }) {
  const shell = desk ? use(desk) : null;
  const access = shell?.access ?? CLOSED_ACCESS;
  // вертикаль та же, что у самого меню: без ответа API меню гостиничное (`menuSectionsFor`), подсветка тоже
  const vertical = shell?.vertical ?? 'HOSPITALITY';
  return (
    <Tabs
      sections={menuSectionsFor(access, vertical)}
      active={activeItem(path, vertical, access)}
      {...props}
    />
  );
}

/** Подсветка одна на всю оболочку (DS2a): раздел горит, если активен его пункт, даже ещё скрытый в меню */
function Tabs({
  sections,
  id,
  active,
  open,
  setOpen,
}: Omit<TabsProps, 'path'> & { sections: MenuSection[]; active: ActiveItem | null }) {
  return (
    <>
      {sections.map((section) => {
        const current = active?.sectionId === section.id;
        // Раздел из одного пункта: вкладка и есть ссылка
        const single = section.direct ? section.items[0] : undefined;
        if (single)
          return (
            <Link
              key={section.id}
              href={single.href}
              prefetch={false}
              className={cx('topmenu__tab', current && 'has-current-page')}
              aria-current={current ? 'page' : undefined}
              data-tour={`section-${section.id}`}
            >
              {section.label}
            </Link>
          );
        const panelId = `${id}-${section.id}`;
        const expanded = open === section.id;
        return (
          <div className="topmenu__group" key={section.id}>
            <button
              type="button"
              className={cx('topmenu__tab', current && 'has-current-page')}
              aria-expanded={expanded}
              aria-controls={panelId}
              data-tour={`section-${section.id}`}
              onClick={() => setOpen(expanded ? null : section.id)}
            >
              <span>{section.label}</span>
              <Icon className="topmenu__chevron" name="down" width={14} />
            </button>
            <div id={panelId} className="topmenu__list" hidden={!expanded}>
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  className={cx('topmenu__link', item.href === active?.href && 'is-active')}
                  aria-current={item.href === active?.href ? 'page' : undefined}
                  onClick={() => setOpen(null)}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

/** Пробный период организации — на каждом экране, а не только на `/login` (ТЗ ux-retention п. 2.7) */
function GrantedTrial({ desk }: { desk: Promise<DeskShell> | undefined }) {
  const trial = desk ? use(desk).trial : null;
  if (!trial) return null;
  return (
    <span className="topmenu__trial" data-testid="trial-line" data-tour="trial">
      <Icon name="clock" width={16} />
      <span>{trial}</span>
    </span>
  );
}
