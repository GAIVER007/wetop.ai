import Link from 'next/link';
import { ANALYTICS_PATH } from './params';

/**
 * Вкладки модуля «Аналитика» (ADR-114): ссылки с `aria-current`, приём «Настроек гостиницы» (`.settings-tabs`).
 * «Брони», «Продажи» и «Категории» появятся срезами AN3–AN5 — пустых заглушек нет.
 */
export function AnalyticsTabs({ current }: { current: 'overview' | 'occupancy' }) {
  const tabs = [
    { id: 'overview', label: 'Обзор', href: ANALYTICS_PATH },
    { id: 'occupancy', label: 'Загрузка', href: `${ANALYTICS_PATH}/occupancy` },
  ] as const;
  return (
    <nav className="settings-tabs pa-tabs" aria-label="Аналитика" data-testid="pa-tabs">
      {tabs.map((t) => (
        <Link key={t.id} href={t.href} aria-current={t.id === current ? 'page' : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
