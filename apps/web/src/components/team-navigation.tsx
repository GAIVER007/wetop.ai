'use client';
import Link from 'next/link';
import { useT } from '../i18n/locale-provider';

export function TeamNavigation({
  current,
  owner,
}: {
  current: 'team' | 'roles' | 'journal';
  owner: boolean;
}) {
  const t = useT();
  return (
    <nav className="control-tabs" aria-label={t('Сотрудники и контроль')}>
      <Link href="/team" prefetch={false} aria-current={current === 'team' ? 'page' : undefined}>
        {t('Сотрудники')}
      </Link>
      <Link
        href="/team/roles"
        prefetch={false}
        aria-current={current === 'roles' ? 'page' : undefined}
      >
        {t('Роли и права')}
      </Link>
      {owner && (
        <Link
          href="/journal"
          prefetch={false}
          aria-current={current === 'journal' ? 'page' : undefined}
        >
          {t('История действий')}
        </Link>
      )}
    </nav>
  );
}
