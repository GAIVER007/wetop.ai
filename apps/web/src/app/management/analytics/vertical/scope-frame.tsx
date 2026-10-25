'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useT } from '../../../../i18n/locale-provider';
/** Hide previous report immediately while the trusted branch selection is pending. */
export function ReportScopeFrame({ children }: { children: ReactNode }) {
  const t = useT();
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
  return switching ? <p role="status">{t('Переключаем филиал…')}</p> : children;
}
