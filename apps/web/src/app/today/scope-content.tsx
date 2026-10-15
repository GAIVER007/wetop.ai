'use client';
import { useEffect, useState, type ReactNode } from 'react';

/** Keep previous streamed content hidden until the selected branch's keyed page arrives. */
export function TodayScopeContent({ children }: { children: ReactNode }) {
  const [switching, setSwitching] = useState(false);
  useEffect(() => {
    const begin = () => setSwitching(true);
    const failed = () => setSwitching(false);
    window.addEventListener('wetop-scope-switch', begin);
    window.addEventListener('wetop-scope-switch-failed', failed);
    return () => {
      window.removeEventListener('wetop-scope-switch', begin);
      window.removeEventListener('wetop-scope-switch-failed', failed);
    };
  }, []);
  return switching ? (
    <main id="main-content" tabIndex={-1}>
      <h1>Сегодня</h1>
      <p role="status">Переключаем филиал…</p>
    </main>
  ) : (
    children
  );
}
