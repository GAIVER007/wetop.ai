import { Tabs } from '../../components/tabs';
import { menuSectionsFor, type NavigationAccess } from '../../lib/navigation';
import type { WebVertical } from '../../lib/vertical-landing';
import { translator, type Translate } from '../../i18n';

/**
 * Вкладки раздела «Клиенты» (аудит 21.10.2026 п.20): меню подсвечивает «Клиенты» на обеих страницах, а перейти между
 * ними было нечем. Эталон салона «Клиенты | Записи» у всех направлений (решение владельца 25.10.2026): пункты и
 * подписи берутся из меню своего направления, поэтому у гостиницы «Клиенты | Записи», у ресторана
 * «Клиенты | Брони столов». Вкладки видны, только когда открыты обе страницы.
 */
export function CustomerSectionTabs({
  access,
  vertical,
  current,
  t = translator('ru'),
}: {
  access: NavigationAccess;
  vertical: WebVertical;
  /** адрес текущей страницы раздела, как он стоит в меню */
  current: string;
  t?: Translate;
}) {
  const items = menuSectionsFor(access, vertical).find((s) => s.id === 'clients')?.items ?? [];
  if (items.length < 2) return null;
  return (
    <Tabs
      label={t('Клиенты и записи')}
      items={items.map((item) => ({ href: item.href, label: t(item.label), current: item.href === current }))}
    />
  );
}
