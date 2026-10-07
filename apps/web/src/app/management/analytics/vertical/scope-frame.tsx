'use client';
import { useEffect, useState, type ReactNode } from 'react';
/** Hide previous report immediately while the trusted branch selection is pending. */
export function ReportScopeFrame({ children }: { children: ReactNode }) {
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
  return switching ? <p role="status">Переключаем филиал…</p> : children;
}
