import Link from 'next/link';
import { deskShell } from '../lib/desk-shell';
import { mayAccess } from '../lib/navigation';
import { Icon } from './icon';

export async function ControlNavigation({ current }: { current: 'incidents' | 'journal' }) {
  const desk = await deskShell();
  return (
    <nav className="control-tabs" aria-label="Контроль">
      <Link
        href="/incidents"
        prefetch={false}
        aria-current={current === 'incidents' ? 'page' : undefined}
      >
        <Icon name="incidents" /> Неисправности
      </Link>
      {mayAccess(desk.access, 'journal') && (
        <Link
          href="/journal"
          prefetch={false}
          aria-current={current === 'journal' ? 'page' : undefined}
        >
          <Icon name="journal" /> Журнал операций
        </Link>
      )}
    </nav>
  );
}
