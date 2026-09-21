import Link from 'next/link';
import { Icon } from './icon';

export function ControlNavigation({ current }: { current: 'incidents' | 'journal' }) {
  return (
    <nav className="control-tabs" aria-label="Контроль">
      <Link
        href="/incidents"
        prefetch={false}
        aria-current={current === 'incidents' ? 'page' : undefined}
      >
        <Icon name="incidents" /> Неисправности
      </Link>
      <Link
        href="/journal"
        prefetch={false}
        aria-current={current === 'journal' ? 'page' : undefined}
      >
        <Icon name="journal" /> Журнал действий
      </Link>
    </nav>
  );
}
