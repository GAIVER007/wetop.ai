'use client';
import Link from 'next/link';
import { Suspense, use, useEffect, useId, useState } from 'react';
import {
  CLOSED_ACCESS,
  activeItem,
  menuSectionsFor,
  type ActiveItem,
  type MenuSection,
} from '../../lib/navigation';
import type { DeskPerson, DeskShell } from '../../lib/desk-person';
import { DataFreshness } from '../data-freshness';
import { Icon } from '../icon';
import { GrantedProperty, PropertyBlock, type PropertyIdentity } from './property-block';
import { cx } from '../ui';
export type { PropertyIdentity } from './property-block';

/**
 * Меню телефона и планшета (до 960 px, окно «Навигация»): те же разделы, что в строке вкладок шапки
 * (ADR-134), раздел из одного пункта прямой ссылкой, группа раскрывашкой; внизу пробный срок,
 * свежесть Channex и кто вошёл.
 */
export function Sidebar({
  path,
  close,
  property,
  desk,
}: {
  path: string;
  close?: () => void;
  property?: PropertyIdentity | null;
  /** Что открыто вошедшему и кто он (ADR-083); пока API не ответил — меню без закрытых пунктов */
  desk?: Promise<DeskShell> | undefined;
}) {
  const id = useId();
  const links: LinksProps = { id, path, close };
  return (
    <div className="sidebar-shell">
      <Suspense fallback={<PropertyBlock property={property} settings={false} close={close} />}>
        <GrantedProperty desk={desk} property={property} close={close} path={path} />
      </Suspense>
      <nav className="workspace-links" aria-label="Разделы">
        {/* пока API не ответил — меню как у администратора: пункты появляются, а не исчезают (ADR-107) */}
        <Suspense fallback={null}>
          <GrantedSectionLinks desk={desk} {...links} />
        </Suspense>
      </nav>
      <div className="sidebar-bottom">
        <Suspense fallback={null}>
          <GrantedTrial desk={desk} />
        </Suspense>
        {/* Свежесть данных Channex и очереди ARI. */}
        <div className="sidebar-freshness">
          <DataFreshness />
        </div>
        <Link href="/profile" className="workspace-footer" onClick={() => close?.()}>
          <Suspense fallback={<FooterPerson person={null} />}>
            <GrantedFooterPerson desk={desk} />
          </Suspense>
          <Icon name="more" />
        </Link>
      </div>
    </div>
  );
}

interface LinksProps {
  id: string;
  path: string;
  close: (() => void) | undefined;
}

/**
 * Подсветка и раскрытая группа считаются по меню направления вошедшего (DS2a): раньше раздел искали в гостиничном
 * меню, и у салона и ресторана группа не раскрывалась и не горела.
 */
function GrantedSectionLinks({
  desk,
  path,
  ...props
}: LinksProps & { desk: Promise<DeskShell> | undefined }) {
  const shell = desk ? use(desk) : null;
  const access = shell?.access ?? CLOSED_ACCESS;
  // вертикаль та же, что у самого меню: без ответа API меню гостиничное (`menuSectionsFor`), подсветка тоже
  const vertical = shell?.vertical ?? 'HOSPITALITY';
  const active = activeItem(path, vertical, access);
  const activeSection = active?.sectionId;
  const [expanded, setExpanded] = useState<string | null>(activeSection ?? null);
  useEffect(() => {
    if (activeSection) setExpanded(activeSection);
  }, [activeSection, path]);
  return (
    <SectionLinks
      sections={menuSectionsFor(access, vertical)}
      active={active}
      expanded={expanded}
      setExpanded={setExpanded}
      {...props}
    />
  );
}

function SectionLinks({
  sections,
  id,
  active,
  expanded,
  setExpanded,
  close,
}: Omit<LinksProps, 'path'> & {
  sections: MenuSection[];
  active: ActiveItem | null;
  expanded: string | null;
  setExpanded: (value: string | null) => void;
}) {
  return (
    <>
      {sections.map((section) => {
        const open = expanded === section.id;
        const selected = active?.sectionId === section.id;
        const panelId = `${id}-${section.id}`;
        // Раздел из одного пункта (ADR-108): прямая ссылка вместо раскрывашки с единственной строкой
        const single = section.direct ? section.items[0] : undefined;
        if (single)
          return (
            <div className="sidebar-section" key={section.id}>
              <Link
                href={single.href}
                prefetch={false}
                onClick={() => close?.()}
                className={cx('sidebar-section-toggle', selected && 'has-current-page')}
                aria-current={single.href === active?.href ? 'page' : undefined}
              >
                <Icon name={section.icon} />
                <span>{section.label}</span>
              </Link>
            </div>
          );
        return (
          <div className="sidebar-section" key={section.id}>
            <button
              type="button"
              className={cx('sidebar-section-toggle', selected && 'has-current-page')}
              aria-label={section.label}
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setExpanded(open ? null : section.id)}
            >
              <Icon name={section.icon} />
              <span>{section.label}</span>
              <Icon className="sidebar-section-chevron" name="down" />
            </button>
            <div id={panelId} className="sidebar-section-links" hidden={!open}>
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  onClick={() => close?.()}
                  title={item.label}
                  className={cx('workspace-link', item.href === active?.href && 'is-active')}
                  aria-current={item.href === active?.href ? 'page' : undefined}
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
    <p className="sidebar-trial" data-testid="trial-line">
      <Icon name="clock" width={16} />
      <span>{trial}</span>
    </p>
  );
}

function GrantedFooterPerson({ desk }: { desk: Promise<DeskShell> | undefined }) {
  const shell = desk ? use(desk) : null;
  return <FooterPerson person={shell?.person ?? null} />;
}

/** Подпись внизу меню: кто вошёл и его роль; вошедшего нет — прежняя «Администратор» */
function FooterPerson({ person }: { person: DeskPerson | null }) {
  return (
    <>
      <span className="desk-avatar">{person?.initials ?? 'АД'}</span>
      <div>
        <strong>{person?.name ?? 'Администратор'}</strong>
        <span>{person?.caption ?? 'Рабочее пространство'}</span>
      </div>
    </>
  );
}
