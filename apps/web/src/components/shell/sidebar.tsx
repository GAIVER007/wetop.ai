'use client';
import Link from 'next/link';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { sidebarSections, activeNavigation } from '../../lib/navigation';
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
}: {
  path: string;
  close?: () => void;
  collapsed?: boolean;
  onCollapse?: () => void;
  property?: PropertyIdentity | null;
}) {
  const active = activeNavigation(path)?.href;
  const activeSection = sidebarSections.find((section) =>
    section.items.some((item) => item.href === active),
  )?.id;
  const [expanded, setExpanded] = useState<string | null>(activeSection ?? 'guests');
  const id = useId();
  useEffect(() => {
    if (activeSection) setExpanded(activeSection);
  }, [activeSection, path]);
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
      <Link
        href="/hotel-settings/description"
        className="workspace-property"
        onClick={() => close?.()}
      >
        <span className="property-mark">
          <Icon name="inventory" />
        </span>
        <div>
          <strong>{property?.name ?? 'Объект не загружен'}</strong>
          <span>{property?.address ?? 'Настройки гостиницы'}</span>
        </div>
        <Icon name="chevron" width={14} />
      </Link>
      <nav className="workspace-links" aria-label="Разделы">
        {sidebarSections.map((section) => {
          const open = !collapsed && expanded === section.id;
          const selected = activeSection === section.id;
          const panelId = `${id}-${section.id}`;
          return (
            <div className="sidebar-section" key={section.id}>
              <button
                type="button"
                className={cx('sidebar-section-toggle', selected && 'has-current-page')}
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
        })}
      </nav>
      <div className="sidebar-bottom">
        {/* Свежесть данных: Exely · Channex · очередь ARI (план wetop-live-data, шаг 4) */}
        <div className="sidebar-freshness">
          <DataFreshness />
        </div>
        <Link href="/profile" className="workspace-footer" onClick={() => close?.()}>
          <span className="desk-avatar">АД</span>
          <div>
            <strong>Администратор</strong>
            <span>Рабочее пространство</span>
          </div>
          <Icon name="more" />
        </Link>
      </div>
    </div>
  );
}
