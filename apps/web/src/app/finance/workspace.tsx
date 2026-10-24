'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { msg } from '../../i18n';
import { useT } from '../../i18n/locale-provider';

type View = 'overview' | 'operations' | 'debts' | 'services' | 'cash';
const tabs = [
  { id: 'overview', label: msg('Обзор'), hash: '#overview' },
  { id: 'operations', label: msg('Операции'), hash: '#operations' },
  { id: 'debts', label: msg('Долги'), hash: '#debts' },
  // REP2: отчёт по услугам — свод начислений-услуг периода
  { id: 'services', label: msg('Услуги'), hash: '#services' },
  { id: 'cash', label: msg('Касса'), hash: '#cash' },
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
  services,
  cash,
}: {
  initialView: View | null;
  overview: ReactNode;
  operations: ReactNode;
  debts: ReactNode;
  services: ReactNode;
  cash: ReactNode;
}) {
  const t = useT();
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => '',
  );
  const active =
    hash === '#finance-filters'
      ? 'operations'
      : hash === '#charges'
        ? 'overview'
        : (tabs.find((tab) => tab.hash === hash)?.id ?? initialView ?? 'overview');
  const choose = (index: number) => {
    const tab = tabs[index]!;
    window.history.pushState(null, '', tab.hash);
    window.dispatchEvent(new Event('hashchange'));
    document.getElementById(`finance-tab-${tab.id}`)?.focus();
  };
  const panels = { overview, operations, debts, services, cash };
  return (
    <div className="finance-workspace finance-more">
      <div id="finance-details">
        <div className="finance-tabs" role="tablist" aria-label={t('Детализация финансов')}>
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
              {t(tab.label)}
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
    </div>
  );
}
