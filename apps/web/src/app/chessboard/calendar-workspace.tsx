'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useT } from '../../i18n/locale-provider';

const Expansion = createContext({ expanded: false, toggle: () => {} });

/** Keep dialogs in the document so booking menus also work in the expanded workspace. */
export function CalendarWorkspace({
  summary,
  children,
  nativeLayout = false,
}: {
  summary: ReactNode;
  children: ReactNode;
  nativeLayout?: boolean;
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const workspace = root.current;
    const page = nativeLayout
      ? workspace?.querySelector<HTMLElement>('.calendar-page')
      : workspace?.closest<HTMLElement>('.calendar-page');
    if (!workspace || !page) return;
    const resize = () => {
      if (window.innerWidth <= 600 && !expanded) {
        page.style.removeProperty('height');
        return;
      }
      const available = window.innerHeight - page.getBoundingClientRect().top;
      page.style.height = `${available}px`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    const header = document.querySelector('.workspace-header');
    if (header) observer.observe(header);
    window.addEventListener('resize', resize);
    const escape = (event: KeyboardEvent) => {
      if (!expanded || event.defaultPrevented || document.querySelector('dialog[open]')) return;
      if (event.key === 'Tab' && page.contains(document.activeElement)) {
        const targets = [
          ...page.querySelectorAll<HTMLElement>(
            'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])',
          ),
        ].filter((element) => !element.matches(':disabled') && element.getClientRects().length > 0);
        const first = targets[0];
        const last = targets.at(-1);
        const target =
          event.shiftKey && document.activeElement === first
            ? last
            : !event.shiftKey && document.activeElement === last
              ? first
              : null;
        if (target) {
          event.preventDefault();
          target.focus();
        }
      }
      if (event.key !== 'Escape') return;
      setExpanded(false);
      workspace
        .querySelector<HTMLButtonElement>('.calendar-expand')
        ?.focus({ preventScroll: true });
    };
    window.addEventListener('keydown', escape);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', escape);
    };
  }, [expanded, nativeLayout]);
  return (
    <Expansion.Provider value={{ expanded, toggle: () => setExpanded((value) => !value) }}>
      <div
        ref={root}
        className={nativeLayout ? 'calendar-shell' : 'calendar-workspace'}
        data-expanded={expanded}
      >
        {nativeLayout ? children : <div className="calendar-workspace__main">{children}</div>}
        {summary && (
          <details className="calendar-workspace__summary" open>
            <summary>{t('Сводка дня')}</summary>
            {summary}
          </details>
        )}
      </div>
    </Expansion.Provider>
  );
}

export function CalendarExpandButton({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const { expanded, toggle } = useContext(Expansion);
  return (
    <button
      type="button"
      className={compact ? 'icon-button calendar-expand' : 'btn btn--secondary calendar-expand'}
      aria-pressed={expanded}
      onClick={toggle}
    >
      {compact && (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />
        </svg>
      )}
      <span className={compact ? 'sr-only' : undefined}>
        {expanded ? t('Выйти из полного экрана') : t('На весь экран')}
      </span>
    </button>
  );
}
