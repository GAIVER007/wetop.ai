'use client';
import { useEffect } from 'react';

/** Browser history can restore edited native fields instead of the applied URL. */
export function FilterHistory({ defaults }: { defaults: Record<string, string> }) {
  useEffect(() => {
    const restore = () => {
      const q = new URLSearchParams(window.location.search);
      const form = document.querySelector<HTMLFormElement>('[data-testid="period-form"]');
      for (const [name, fallback] of Object.entries(defaults)) {
        const field = form?.elements.namedItem(name);
        if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement)
          field.value = q.get(name) ?? fallback;
      }
    };
    restore();
    window.addEventListener('pageshow', restore);
    window.addEventListener('popstate', restore);
    return () => {
      window.removeEventListener('pageshow', restore);
      window.removeEventListener('popstate', restore);
    };
  }, [defaults]);
  return null;
}
