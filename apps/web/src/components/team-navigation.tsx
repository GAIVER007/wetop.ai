'use client';
import Link from 'next/link';
import { useT } from '../i18n/locale-provider';

export function TeamNavigation({
  current,
  teamHref = '/team',
}: {
  current: 'team' | 'roles' | 'journal';
  /** прежний признак владельца; «История действий» с 31.10.2026 только в «Настройках» */
  owner?: boolean;
  /** у салона и ресторана список людей это общий экран `/employees` (plans/unified-team-screen-2026-10-25.md, U2) */
  teamHref?: string;
}) {
  const t = useT();
  return (
    <nav className="control-tabs" aria-label={t('Сотрудники и контроль')}>
      <Link href={teamHref} prefetch={false} aria-current={current === 'team' ? 'page' : undefined}>
        {t('Сотрудники')}
      </Link>
      <Link
        href="/team/roles"
        prefetch={false}
        aria-current={current === 'roles' ? 'page' : undefined}
      >
        {t('Роли и права')}
      </Link>
    </nav>
  );
}
