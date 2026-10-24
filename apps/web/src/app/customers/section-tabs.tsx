import { Tabs } from '../../components/tabs';
import { pageOpen, type NavigationAccess } from '../../lib/navigation';
import { translator, type Translate } from '../../i18n';

/**
 * «Клиенты | Записи» салона (аудит 21.10.2026 п.20): меню подсвечивает «Клиенты» на обеих страницах, а перейти между
 * ними было нечем. Вкладки видны, только когда открыты обе страницы.
 */
export function CustomerSectionTabs({
  access,
  current,
  t = translator('ru'),
}: {
  access: NavigationAccess;
  current: 'customers' | 'appointments';
  t?: Translate;
}) {
  if (!pageOpen(access, 'desk', '/customers') || !pageOpen(access, 'desk', '/appointments')) return null;
  return (
    <Tabs
      label={t('Клиенты и записи')}
      items={[
        { href: '/customers', label: t('Клиенты'), current: current === 'customers' },
        { href: '/appointments', label: t('Записи'), current: current === 'appointments' },
      ]}
    />
  );
}
