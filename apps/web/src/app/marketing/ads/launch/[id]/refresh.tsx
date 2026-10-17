'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Пока запуск идёт в фоне, страница перечитывает его раз в 2 секунды (без отдельного канала событий) */
export function RefreshWhileRunning() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(t);
  }, [router]);
  return (
    <p className="settings-note" role="status">
      Шаги обновляются сами.
    </p>
  );
}
