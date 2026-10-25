'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useT } from '../../../../../i18n/locale-provider';

/** Пока запуск идёт в фоне, страница перечитывает его раз в 2 секунды (без отдельного канала событий) */
export function RefreshWhileRunning() {
  const router = useRouter();
  const t = useT();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(timer);
  }, [router]);
  return (
    <p className="settings-note" role="status">
      {t('Шаги обновляются сами.')}
    </p>
  );
}
