import { Tabs } from '../../components/tabs';

/** «Сотрудники» ресторана двумя вкладками-маршрутами: список и график смен (Q-REST-11) */
export function StaffTabs({ current }: { current: 'list' | 'shifts' }) {
  return (
    <Tabs
      label="Раздел сотрудников"
      items={[
        { href: '/employees', label: 'Сотрудники', current: current === 'list' },
        { href: '/employees/shifts', label: 'График смен', current: current === 'shifts' },
      ]}
    />
  );
}
