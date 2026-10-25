import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { loadFood } from '../food/load';
import { foodApi } from '../../lib/food-api';
import { RestaurantSettings, type SettingsSection } from '../food/settings-board';
import { OpeningForm } from './opening-form';
import { FoodReminderForm } from './reminder-form';
import { loadOpening } from './opening-actions';
import { serverT } from '../../i18n/server';
import '../food/food.css';
import '../food/restaurant.css';

const SECTIONS: SettingsSection[] = ['hours', 'bookings', 'reminders'];

/** «Настройки ресторана» по макету владельца (экран 13): разделы слева, часы работы по дням справа */
export default async function RestaurantSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section } = await searchParams;
  const current = SECTIONS.find((s) => s === section) ?? 'hours';
  const t = await serverT();
  try {
    const data = await loadFood();
    const booking = current === 'bookings' ? await foodApi.bookingRules() : undefined;
    const opening = current === 'hours' ? await loadOpening() : undefined;
    const reminders = current === 'reminders' ? await foodApi.reminderSettings() : undefined;
    return (
      <Page title={t('Настройки ресторана')}>
        <div key={data.scopeKey}>
          <RestaurantSettings data={data} section={current} booking={booking} physicalOpening={opening ? <OpeningForm initial={opening} scopeKey={data.scopeKey} timezone={data.timezone} write={data.canProperty && !data.readOnly} /> : undefined} reminders={reminders ? <FoodReminderForm key={data.scopeKey} initial={reminders} scopeKey={data.scopeKey} canEdit={data.canProperty && !data.readOnly} /> : undefined} />
        </div>
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title={t('Настройки ресторана')}>
        <LoadError testId="restaurant-settings-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
