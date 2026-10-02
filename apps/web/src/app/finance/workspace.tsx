'use client';

import { useSyncExternalStore, type ReactNode } from 'react';

type View = 'overview' | 'operations' | 'debts' | 'cash';
const tabs = [
  { id: 'overview', label: 'Обзор', hash: '#charges' },
  { id: 'operations', label: 'Операции', hash: '#operations' },
  { id: 'debts', label: 'Долги', hash: '#debts' },
  { id: 'cash', label: 'Касса', hash: '#cash' },
] as const;
function subscribe(notify: () => void) {
  window.addEventListener('hashchange', notify);
  window.addEventListener('popstate', notify);
  return () => {
    window.removeEventListener('hashchange', notify);
    window.removeEventListener('popstate', notify);
  };
}

/** Existing bookmarked drill-down links keep opening the corresponding panel. */
export function FinanceWorkspace({
  initialView,
  overview,
  operations,
  debts,
  cash,
}: {
  initialView: View;
  overview: ReactNode;
  operations: ReactNode;
  debts: ReactNode;
  cash: ReactNode;
}) {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => '',
  );
  const active = tabs.find((tab) => tab.hash === hash)?.id ?? initialView;
  const choose = (index: number) => {
    const tab = tabs[index]!;
    window.history.pushState(null, '', tab.hash);
    window.dispatchEvent(new Event('hashchange'));
    document.getElementById(`finance-tab-${tab.id}`)?.focus();
  };
  const panels = { overview, operations, debts, cash };
  return (
    <div className="finance-workspace">
      <div className="finance-tabs" role="tablist" aria-label="Детализация финансов">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`finance-tab-${tab.id}`}
            aria-controls={`finance-panel-${tab.id}`}
            aria-selected={active === tab.id}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => choose(index)}
            onKeyDown={(event) => {
              const next =
                event.key === 'ArrowRight'
                  ? (index + 1) % tabs.length
                  : event.key === 'ArrowLeft'
                    ? (index + tabs.length - 1) % tabs.length
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? tabs.length - 1
                        : null;
              if (next !== null) {
                event.preventDefault();
                choose(next);
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`finance-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`finance-tab-${tab.id}`}
          hidden={active !== tab.id}
          tabIndex={0}
          className="finance-tab-panel"
        >
          {panels[tab.id]}
        </div>
      ))}
    </div>
  );
}
