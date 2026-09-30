import Link from 'next/link';

/**
 * Вкладки «Тарифов и цен» (SET4, дополнение 29.09 к ADR-115): календарь цен и тарифные планы с правилом отмены.
 * Приём «Настроек объекта» и «Аналитики» — ссылки с `aria-current` (`.settings-tabs`).
 */
export function RatesTabs({ current }: { current: 'prices' | 'plans' | 'promo' }) {
  const tabs = [
    { id: 'prices', label: 'Цены', href: '/rates' },
    { id: 'plans', label: 'Тарифные планы', href: '/rates/plans' },
    { id: 'promo', label: 'Промокоды', href: '/rates/promo' },
  ] as const;
  return (
    <nav className="settings-tabs" aria-label="Тарифы и цены" data-testid="rates-tabs">
      {tabs.map((t) => (
        <Link key={t.id} href={t.href} aria-current={t.id === current ? 'page' : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
