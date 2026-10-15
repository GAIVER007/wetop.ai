import Link from 'next/link';

export function TeamNavigation({
  current,
  owner,
}: {
  current: 'team' | 'roles' | 'journal';
  owner: boolean;
}) {
  return (
    <nav className="control-tabs" aria-label="Сотрудники и контроль">
      <Link href="/team" prefetch={false} aria-current={current === 'team' ? 'page' : undefined}>
        Сотрудники
      </Link>
      <Link
        href="/team/roles"
        prefetch={false}
        aria-current={current === 'roles' ? 'page' : undefined}
      >
        Роли и права
      </Link>
      {owner && (
        <Link
          href="/journal"
          prefetch={false}
          aria-current={current === 'journal' ? 'page' : undefined}
        >
          Журнал операций
        </Link>
      )}
    </nav>
  );
}
