'use client';
import Link from 'next/link';
import { Suspense, use, useEffect, useId, useState, type ReactNode } from 'react';
import {
  CLOSED_ACCESS,
  PENDING_ACCESS,
  allowedItem,
  sidebarSections,
  sidebarSectionsFor,
  activeNavigation,
  type SidebarSection,
} from '../../lib/navigation';
import type { DeskPerson, DeskShell } from '../../lib/desk-person';
import { DataFreshness } from '../data-freshness';
import { Icon } from '../icon';
import { cx } from '../ui';
/** Server-rendered text slots keep late metadata independent of the interactive shell. */
export interface PropertyIdentity {
  name: ReactNode;
  address: ReactNode;
}
export function Sidebar({
  path,
  close,
  collapsed,
  onCollapse,
  property,
  desk,
}: {
  path: string;
  close?: () => void;
  collapsed?: boolean;
  onCollapse?: () => void;
  property?: PropertyIdentity | null;
  /** Что открыто вошедшему и кто он (ADR-083); пока API не ответил — меню без закрытых пунктов */
  desk?: Promise<DeskShell> | undefined;
}) {
  const route = activeNavigation(path)?.href;
  const active = route?.startsWith('/hotel-settings') ? '/hotel-settings' : route;
  const activeSection = sidebarSections.find((section) =>
    section.items.some((item) => item.href === active),
  )?.id;
  const [expanded, setExpanded] = useState<string | null>(activeSection ?? 'guests');
  const id = useId();
  useEffect(() => {
    if (activeSection) setExpanded(activeSection);
  }, [activeSection, path]);
  const links: LinksProps = {
    id,
    active,
    activeSection,
    expanded,
    setExpanded,
    collapsed,
    onCollapse,
    close,
  };
  return (
    <div className={cx('sidebar-shell', collapsed && 'is-compact')}>
      <div className="brand-row">
        <Link
          className="workspace-brand"
          href="/today"
          aria-label="WETOP — Сегодня"
          onClick={() => close?.()}
        >
          <span className="workspace-mark">W</span>
          <span className="brand-name">
            WETOP<span>.AI</span>
          </span>
        </Link>
        {onCollapse && (
          <button
            className="icon-button sidebar-collapse"
            aria-label={collapsed ? 'Развернуть панель' : 'Свернуть панель'}
            onClick={onCollapse}
          >
            <Icon name={collapsed ? 'expand' : 'collapse'} />
          </button>
        )}
      </div>
      <Suspense fallback={<PropertyBlock property={property} settings={false} close={close} />}>
        <GrantedProperty desk={desk} property={property} close={close} />
      </Suspense>
      <nav className="workspace-links" aria-label="Разделы">
        {/* пока API не ответил — меню как у администратора: пункты появляются, а не исчезают (ADR-101) */}
        <Suspense
          fallback={<SectionLinks sections={sidebarSectionsFor(PENDING_ACCESS)} {...links} />}
        >
          <GrantedSectionLinks desk={desk} {...links} />
        </Suspense>
      </nav>
      <div className="sidebar-bottom">
        <Suspense fallback={null}>
          <GrantedTrial desk={desk} />
        </Suspense>
        {/* Свежесть данных: Exely · Channex · очередь ARI (план wetop-live-data, шаг 4) */}
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
  active: string | undefined;
  activeSection: string | undefined;
  expanded: string | null;
  setExpanded: (value: string | null) => void;
  collapsed: boolean | undefined;
  onCollapse: (() => void) | undefined;
  close: (() => void) | undefined;
}

function GrantedSectionLinks({
  desk,
  ...props
}: LinksProps & { desk: Promise<DeskShell> | undefined }) {
  const shell = desk ? use(desk) : null;
  return <SectionLinks sections={sidebarSectionsFor(shell?.access ?? CLOSED_ACCESS)} {...props} />;
}

function SectionLinks({
  sections,
  id,
  active,
  activeSection,
  expanded,
  setExpanded,
  collapsed,
  onCollapse,
  close,
}: LinksProps & { sections: SidebarSection[] }) {
  return (
    <>
      {sections.map((section) => {
        const open = !collapsed && expanded === section.id;
        const selected = activeSection === section.id;
        const panelId = `${id}-${section.id}`;
        return (
          <div className="sidebar-section" key={section.id}>
            <button
              type="button"
              className={cx('sidebar-section-toggle', selected && 'has-current-page')}
              data-tour={`section-${section.id}`}
              aria-label={section.label}
              aria-expanded={open}
              aria-controls={panelId}
              title={collapsed ? section.label : undefined}
              onClick={() => {
                setExpanded(open ? null : section.id);
                if (collapsed) onCollapse?.();
              }}
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
                  className={cx('workspace-link', item.href === active && 'is-active')}
                  aria-current={item.href === active ? 'page' : undefined}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        );
      })}{' '}
    </>
  );
}

/** Объект вверху панели ведёт в настройки гостиницы — тем, кому они открыты (ADR-101) */
function GrantedProperty({
  desk,
  ...props
}: {
  desk: Promise<DeskShell> | undefined;
  property?: PropertyIdentity | null | undefined;
  close: (() => void) | undefined;
}) {
  const shell = desk ? use(desk) : null;
  const settings = allowedItem({ requires: 'settings' }, shell?.access ?? CLOSED_ACCESS);
  return <PropertyBlock {...props} settings={settings} />;
}

function PropertyBlock({
  property,
  settings,
  close,
}: {
  property?: PropertyIdentity | null | undefined;
  settings: boolean;
  close: (() => void) | undefined;
}) {
  const identity = (
    <>
      <span className="property-mark">
        <Icon name="inventory" />
      </span>
      <div>
        <strong>{property?.name ?? 'Объект не загружен'}</strong>
        <span>{property?.address ?? 'Настройки гостиницы'}</span>
      </div>
    </>
  );
  return settings ? (
    <Link href="/hotel-settings" className="workspace-property" onClick={() => close?.()}>
      {identity}
      <Icon name="chevron" width={14} />
    </Link>
  ) : (
    <div className="workspace-property">{identity}</div>
  );
}

/** Пробный период организации — на каждом экране, а не только на `/login` (ТЗ ux-retention п. 2.7) */
function GrantedTrial({ desk }: { desk: Promise<DeskShell> | undefined }) {
  const trial = desk ? use(desk).trial : null;
  if (!trial) return null;
  return (
    <p className="sidebar-trial" data-testid="trial-line" data-tour="trial">
      <Icon name="clock" width={16} />
      <span>{trial}</span>
    </p>
  );
}

function GrantedFooterPerson({ desk }: { desk: Promise<DeskShell> | undefined }) {
  const shell = desk ? use(desk) : null;
  return <FooterPerson person={shell?.person ?? null} />;
}

/** Подпись внизу панели: кто вошёл и его роль; вошедшего нет — прежняя «Администратор» */
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
