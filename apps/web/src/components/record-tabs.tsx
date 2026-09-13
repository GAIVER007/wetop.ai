'use client';
import { useEffect, useId, useState, type ReactNode } from 'react';
export function RecordTabs({
  tabs,
  label = 'Разделы карточки',
}: {
  tabs: Array<{ id: string; label: string; content: ReactNode }>;
  label?: string;
}) {
  const [active, setActive] = useState(tabs[0]!.id);
  const prefix = useId();
  useEffect(() => {
    const sync = () => {
      const id = location.hash.slice(1);
      if (tabs.some((t) => t.id === id)) setActive(id);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [tabs]);
  const select = (id: string) => {
    setActive(id);
    // Next copies its internal state and synchronizes the router when data is null.
    history.replaceState(null, '', `${location.pathname}${location.search}#${id}`);
  };
  return (
    <div
      className="record-tabs"
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const anchor = (event.target as Element).closest('a[href^="#"]');
        const id = anchor?.getAttribute('href')?.slice(1);
        if (!id || !tabs.some((tab) => tab.id === id)) return;
        // A shortcut selects a tab, so closing a routed drawer still takes one Back step.
        event.preventDefault();
        select(id);
        document.getElementById(`${prefix}-${id}`)?.focus();
      }}
    >
      <div className="record-tab-list" role="tablist" aria-label={label}>
        {tabs.map((tab, index) => (
          <button
            type="button"
            key={tab.id}
            role="tab"
            id={`${prefix}-${tab.id}`}
            aria-controls={`${prefix}-panel-${tab.id}`}
            aria-selected={active === tab.id}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => select(tab.id)}
            onKeyDown={(e) => {
              const next =
                e.key === 'ArrowRight'
                  ? (index + 1) % tabs.length
                  : e.key === 'ArrowLeft'
                    ? (index + tabs.length - 1) % tabs.length
                    : e.key === 'Home'
                      ? 0
                      : e.key === 'End'
                        ? tabs.length - 1
                        : -1;
              if (next >= 0) {
                e.preventDefault();
                select(tabs[next]!.id);
                document.getElementById(`${prefix}-${tabs[next]!.id}`)?.focus();
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <section
          key={tab.id}
          id={`${prefix}-panel-${tab.id}`}
          role="tabpanel"
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
