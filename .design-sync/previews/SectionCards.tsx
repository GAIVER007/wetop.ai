import { FeaturePending, SectionCards } from '@pms/web';

export const Hub = () => (
  <SectionCards
    items={[
      { href: '/rooms', label: 'Управление номерами', icon: 'inventory' },
      { href: '/rooms/categories', label: 'Категории', icon: 'board' },
      { href: '/rates', label: 'Цены и ограничения', icon: 'rates' },
      { href: '/rooms/availability', label: 'Доступность', icon: 'today' },
    ]}
  />
);

export const WithPending = () => (
  <SectionCards
    items={[
      { href: '/management/statistics', label: 'Статистика', icon: 'analytics' },
      { href: '/marketing', label: 'Акции', icon: 'money', pending: true },
    ]}
  />
);

export const Pending = () => (
  <FeaturePending
    icon="analytics"
    text="Отчёт по акциям появится, когда акции заведут в системе."
  />
);
