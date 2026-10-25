'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { useT } from '../../i18n/locale-provider';
export function AnalyticsDisclosure({ children }: { children: ReactNode }) {
  const t = useT();
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 601px)');
    const sync = () => {
      if (ref.current) ref.current.open = media.matches;
    };
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  return (
    <details ref={ref} open className="bar-analytics-disclosure">
      <summary>{t('Аналитика и топ товаров')}</summary>
      {children}
    </details>
  );
}
