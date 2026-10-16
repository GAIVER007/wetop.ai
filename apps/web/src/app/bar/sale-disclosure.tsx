'use client';
import { useEffect, useRef, type ReactNode } from 'react';
/** Подпись по направлению (ADR-178): «в счёт гостя» есть только у гостиницы */
export function SaleDisclosure({
  children,
  label,
}: {
  children: ReactNode;
  label?: string | undefined;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const sync = () => {
      if (location.hash === '#bar-quick-sale' && ref.current) ref.current.open = true;
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  return (
    <details ref={ref} className="bar-details bar-sale-disclosure" id="bar-quick-sale">
      <summary>{label ?? 'Продажа напрямую или в счёт гостя'}</summary>
      {children}
    </details>
  );
}
