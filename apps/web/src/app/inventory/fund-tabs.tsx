'use client';
import Link from 'next/link';
import { msg } from '../../i18n';
import { useT } from '../../i18n/locale-provider';
export function FundTabs({ active }: { active: 'inventory' | 'categories' | 'availability' }) {
  const t = useT();
  return (
    <nav className="fund-tabs" aria-label={t('Номерной фонд')}>
      {(
        [
          ['inventory', '/inventory', msg('Номера и койки')],
          ['categories', '/rooms/categories', msg('Категории')],
        ] as const
      ).map(([key, href, label]) => (
        <Link key={key} href={href} aria-current={active === key ? 'page' : undefined}>
          {t(label)}
        </Link>
      ))}
    </nav>
  );
}
