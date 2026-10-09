'use client';
import Link from 'next/link';
import { useEffect, useId, useState, type ReactNode } from 'react';

/**
 * Вкладки (MV8.5 DS1b, DESIGN.md §8.1). Один примитив, два режима:
 *  1) маршрутами (`items`): `nav` и ссылки, у текущей `aria-current="page"`; это обычная навигация,
 *    стрелки не перехватываются;
 *  2) на странице (`panels`): `tablist` / `tab` / `tabpanel`, стрелки, Home и End выбирают вкладку сразу
 *    (панель мгновенная), выбранная вкладка живёт в адресе `#id`.
 */
export interface RouteTab {
  href: string;
  label: ReactNode;
  current: boolean;
  count?: number;
}
export interface LocalTab {
  id: string;
  label: ReactNode;
  content: ReactNode;
  count?: number;
}
type TabsProps = { label: string; className?: string } & (
  { items: RouteTab[]; panels?: never } | { panels: LocalTab[]; items?: never }
);

/** Следующая вкладка или сегмент по клавише: стрелки по кругу, Home, End; прочие клавиши дают -1 */
export function rovingIndex(key: string, index: number, length: number): number {
  if (key === 'ArrowRight') return (index + 1) % length;
  if (key === 'ArrowLeft') return (index + length - 1) % length;
  if (key === 'Home') return 0;
  if (key === 'End') return length - 1;
  return -1;
}

const Count = ({ value }: { value?: number | undefined }) =>
  value === undefined ? null : <span className="tabs__count">{value}</span>;

export function Tabs(props: TabsProps) {
  return props.items ? (
    <RouteTabs label={props.label} items={props.items} className={props.className} />
  ) : (
    <LocalTabs label={props.label} panels={props.panels} className={props.className} />
  );
}

function RouteTabs({
  label,
  items,
  className,
}: {
  label: string;
  items: RouteTab[];
  className?: string | undefined;
}) {
  return (
    <nav className={className ? `tabs ${className}` : 'tabs'} aria-label={label}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          prefetch={false}
          className="tabs__item"
          aria-current={item.current ? 'page' : undefined}
        >
          {item.label}
          <Count value={item.count} />
        </Link>
      ))}
    </nav>
  );
}

function LocalTabs({
  label,
  panels,
  className,
}: {
  label: string;
  panels: LocalTab[];
  className?: string | undefined;
}) {
  const [active, setActive] = useState(panels[0]!.id);
  const prefix = useId();
  // Вкладку из адреса берём при появлении карточки, по `hashchange` и при смене набора вкладок — но не на каждой
  // перерисовке с сервера: массив `panels` после server action всегда новый, а адрес в этот миг может быть старым.
  // Ответ действия, пришедший во время клика по другой вкладке, роутер Next применяет с адресом, с которым действие
  // стартовало, и карточка возвращалась на «Действия» (полный UI-набор 28.09.2026, tests/ui/record-tabs.spec.ts).
  // Переход на другую бронь даёт новый экземпляр: сегмент `[number]` роутер монтирует заново.
  const ids = panels.map((t) => t.id).join(' ');
  useEffect(() => {
    const known = ids.split(' ');
    const sync = () => {
      const id = location.hash.slice(1);
      if (known.includes(id)) setActive(id);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [ids]);
  const select = (id: string) => {
    setActive(id);
    // Next copies its internal state and synchronizes the router when data is null.
    history.replaceState(null, '', `${location.pathname}${location.search}#${id}`);
  };
  return (
    <div
      className={className ? `tabs-local ${className}` : 'tabs-local'}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const anchor = (event.target as Element).closest('a[href^="#"]');
        const id = anchor?.getAttribute('href')?.slice(1);
        if (!id || !panels.some((tab) => tab.id === id)) return;
        // A shortcut selects a tab, so closing a routed drawer still takes one Back step.
        event.preventDefault();
        select(id);
        document.getElementById(`${prefix}-${id}`)?.focus();
      }}
    >
      <div className="tabs" role="tablist" aria-label={label}>
        {panels.map((tab, index) => (
          <button
            type="button"
            key={tab.id}
            role="tab"
            className="tabs__item"
            id={`${prefix}-${tab.id}`}
            aria-controls={`${prefix}-panel-${tab.id}`}
            aria-selected={active === tab.id}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => select(tab.id)}
            onKeyDown={(e) => {
              const next = rovingIndex(e.key, index, panels.length);
              if (next < 0) return;
              e.preventDefault();
              select(panels[next]!.id);
              document.getElementById(`${prefix}-${panels[next]!.id}`)?.focus();
            }}
          >
            {tab.label}
            <Count value={tab.count} />
          </button>
        ))}
      </div>
      {panels.map((tab) => (
        <section
          key={tab.id}
          id={`${prefix}-panel-${tab.id}`}
          role="tabpanel"
          className="tabs__panel"
          aria-labelledby={`${prefix}-${tab.id}`}
          hidden={active !== tab.id}
          tabIndex={0}
        >
          {tab.content}
        </section>
      ))}
    </div>
  );
}
