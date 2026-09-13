'use client';
import Link from 'next/link';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { navigation, activeNavigation, type NavigationItem } from '../../lib/navigation';
import { DataFreshness } from '../data-freshness';
import { Icon } from '../icon';
import { cx } from '../ui';
/** Server-rendered text slots keep late metadata independent of the interactive shell. */
export interface PropertyIdentity {
  name: ReactNode;
  address: ReactNode;
}
function Entry({
  item,
  active,
  close,
}: {
  item: NavigationItem;
  active?: string | undefined;
  close?: (() => void) | undefined;
}) {
  const id = useId();
  const selected = item.children?.some((c) => c.href === active) || item.href === active;
  const [expanded, setExpanded] = useState(!!selected);
  useEffect(() => {
    if (selected) setExpanded(true);
  }, [selected]);
  return (
    <div className="nav-entry">
      <div className="nav-entry-row">
        <Link
          href={item.href}
          prefetch={false}
          onClick={() => close?.()}
          title={item.label}
          aria-label={item.label}
          className={cx('workspace-link', selected && 'is-active')}
          aria-current={item.href === active ? 'page' : undefined}
        >
          <Icon name={item.icon} />
          <span>{item.shortLabel ?? item.label}</span>
        </Link>
        {item.children && (
          <button
            className="nav-toggle"
            aria-label={`Подразделы: ${item.label}`}
            aria-expanded={expanded}
            aria-controls={id}
            onClick={() => setExpanded(!expanded)}
          >
            <Icon name="down" />
          </button>
        )}
      </div>
      {item.children && (
        <div id={id} className="nav-children" hidden={!expanded}>
          {item.children.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              prefetch={false}
              onClick={() => close?.()}
              className={cx('nav-child', c.href === active && 'is-active')}
              aria-current={c.href === active ? 'page' : undefined}
            >
              {c.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
export function Sidebar({
  path,
  close,
  onAssistant,
  collapsed,
  onCollapse,
  property,
}: {
  path: string;
  close?: () => void;
  onAssistant: () => void;
  collapsed?: boolean;
  onCollapse?: () => void;
  property?: PropertyIdentity | null;
}) {
  const active = activeNavigation(path)?.href;
  return (
    <>
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
        <Icon name="down" width={14} />
      </Link>
      <nav className="workspace-links" aria-label="Разделы">
        {navigation.map((group) => (
          <div key={group.label}>
            <div className="nav-group">{group.label}</div>
            {group.items.map((item) => (
              <Entry key={item.href} item={item} active={active} close={close} />
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-bottom">
        {/* Свежесть данных: Exely · Channex · очередь ARI (план wetop-live-data, шаг 4) */}
        <div className="sidebar-freshness">
          <DataFreshness />
        </div>
        <button
          className="assistant-launch"
          onClick={() => {
            close?.();
            onAssistant();
          }}
          title="AI Assistant"
        >
          <span className="ai-orb" aria-hidden="true" />
          <span>
            <strong>AI Assistant</strong>
            <small>Помощник вашей смены</small>
          </span>
          <Icon name="arrow" width={16} />
        </button>
        <Link href="/profile" className="workspace-footer" onClick={() => close?.()}>
          <span className="desk-avatar">АД</span>
          <div>
            <strong>Администратор</strong>
            <span>Рабочее пространство</span>
          </div>
          <Icon name="more" />
        </Link>
      </div>
    </>
  );
}
