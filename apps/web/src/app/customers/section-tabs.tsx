import { Tabs } from '../../components/tabs';
import { pageOpen, type NavigationAccess } from '../../lib/navigation';

/**
 * «Клиенты | Записи» салона (аудит 21.10.2026 п.20): меню подсвечивает «Клиенты» на обеих страницах, а перейти между
 * ними было нечем. Вкладки видны, только когда открыты обе страницы.
 */
export function CustomerSectionTabs({
  access,
  current,
}: {
  access: NavigationAccess;
  current: 'customers' | 'appointments';
}) {
  if (!pageOpen(access, 'desk', '/customers') || !pageOpen(access, 'desk', '/appointments')) return null;
  return (
    <Tabs
      label="Клиенты и записи"
      items={[
        { href: '/customers', label: 'Клиенты', current: current === 'customers' },
        { href: '/appointments', label: 'Записи', current: current === 'appointments' },
      ]}
    />
  );
}
