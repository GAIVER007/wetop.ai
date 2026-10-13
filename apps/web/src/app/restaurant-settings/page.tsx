import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { loadFood } from '../food/load';
import { RestaurantSettings, type SettingsSection } from '../food/settings-board';
import '../food/food.css';
import '../food/restaurant.css';

const SECTIONS: SettingsSection[] = ['hours', 'bookings', 'notifications'];

/** «Настройки ресторана» по макету владельца (экран 13): разделы слева, часы работы по дням справа */
export default async function RestaurantSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section } = await searchParams;
  const current = SECTIONS.find((s) => s === section) ?? 'hours';
  try {
    const data = await loadFood();
    return (
      <Page title="Настройки ресторана">
        <div key={data.scopeKey}>
          <RestaurantSettings data={data} section={current} />
        </div>
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title="Настройки ресторана">
        <LoadError testId="restaurant-settings-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
