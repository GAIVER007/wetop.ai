'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Page } from '../../components/page';
/** Keep old streamed page content hidden until its replacement has the new scope. */
export function TodayScopeContent({
  scopeKey,
  children,
}: {
  scopeKey: string;
  children: ReactNode;
}) {
  const [blocked, setBlocked] = useState<string | null>(null);
  useEffect(() => {
    const begin = () => setBlocked(scopeKey);
    const failed = () => setBlocked(null);
    window.addEventListener('wetop-scope-switch', begin);
    window.addEventListener('wetop-scope-switch-failed', failed);
    return () => {
      window.removeEventListener('wetop-scope-switch', begin);
      window.removeEventListener('wetop-scope-switch-failed', failed);
    };
  }, [scopeKey]);
  return blocked === scopeKey ? (
    <Page title="Главная">
      <p role="status">Переключаем филиал…</p>
    </Page>
  ) : (
    children
  );
}
