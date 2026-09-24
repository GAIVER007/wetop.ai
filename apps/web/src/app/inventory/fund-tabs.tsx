import Link from 'next/link';
export function FundTabs({ active }: { active: 'inventory' | 'categories' | 'availability' }) {
  return (
    <nav className="fund-tabs" aria-label="Номерной фонд">
      {(
        [
          ['inventory', '/inventory', 'Номера и койки'],
          ['categories', '/rooms/categories', 'Категории'],
          ['availability', '/rooms/availability', 'Доступность'],
        ] as const
      ).map(([key, href, label]) => (
        <Link key={key} href={href} aria-current={active === key ? 'page' : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
