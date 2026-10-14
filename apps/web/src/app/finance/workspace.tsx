'use client';

import { useSyncExternalStore, type ReactNode } from 'react';

type View = 'dashboard' | 'overview' | 'operations' | 'debts' | 'services' | 'cash';
const tabs = [
  { id: 'dashboard', label: 'Обзор', hash: '#overview' },
  { id: 'overview', label: 'Начисления', hash: '#charges' },
  { id: 'operations', label: 'Операции', hash: '#operations' },
  { id: 'debts', label: 'Долги', hash: '#debts' },
  // REP2: отчёт по услугам — свод начислений-услуг периода
  { id: 'services', label: 'Услуги', hash: '#services' },
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
  dashboard,
  filters,
  periodEditor,
  overview,
  operations,
  debts,
  services,
  cash,
}: {
  initialView: View | null;
  dashboard: ReactNode;
  filters: ReactNode;
  periodEditor: ReactNode;
  overview: ReactNode;
  operations: ReactNode;
  debts: ReactNode;
  services: ReactNode;
  cash: ReactNode;
}) {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => '',
  );
  const active =
    hash === '#finance-filters'
      ? 'operations'
      : (tabs.find((tab) => tab.hash === hash)?.id ?? initialView ?? 'dashboard');
  const choose = (index: number) => {
    const tab = tabs[index]!;
    window.history.pushState(null, '', tab.hash);
    window.dispatchEvent(new Event('hashchange'));
    document.getElementById(`finance-tab-${tab.id}`)?.focus();
  };
  const panels = { dashboard, overview, operations, debts, services, cash };
  return (
    <div className="finance-workspace finance-more">
      <div id="finance-details">
        <div className="finance-tabs" role="tablist" aria-label="Детализация финансов">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`finance-tab-${tab.id}`}
              aria-controls={`finance-panel-${tab.id}`}
              aria-selected={active === tab.id}
              tabIndex={active === tab.id || (active === null && index === 0) ? 0 : -1}
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
        <div hidden={active !== 'operations'}>{filters}</div>
        {active !== 'operations' && active !== 'cash' && (
          <details className="finance-period-editor">
            <summary>Свои даты</summary>
            <form
              method="get"
              action={`/finance${tabs.find((tab) => tab.id === active)?.hash ?? '#overview'}`}
              className="finance-toolbar"
            >
              {periodEditor}
            </form>
          </details>
        )}
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
    </div>
  );
}
