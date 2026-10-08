'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

const Expansion = createContext({ expanded: false, toggle: () => {} });

/** Keep dialogs in the document so booking menus also work in the expanded workspace. */
export function CalendarWorkspace({
  summary,
  children,
}: {
  summary: ReactNode;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const workspace = root.current;
    const page = workspace?.closest<HTMLElement>('.calendar-page');
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
  }, [expanded]);
  return (
    <Expansion.Provider value={{ expanded, toggle: () => setExpanded((value) => !value) }}>
      <div ref={root} className="calendar-workspace" data-expanded={expanded}>
        <div className="calendar-workspace__main">{children}</div>
        {summary && (
          <details className="calendar-workspace__summary" open>
            <summary>Сводка дня</summary>
            {summary}
          </details>
        )}
      </div>
    </Expansion.Provider>
  );
}

export function CalendarExpandButton() {
  const { expanded, toggle } = useContext(Expansion);
  return (
    <button
      type="button"
      className="btn btn--secondary calendar-expand"
      aria-pressed={expanded}
      onClick={toggle}
    >
      {expanded ? 'Выйти из полного экрана' : 'На весь экран'}
    </button>
  );
}
