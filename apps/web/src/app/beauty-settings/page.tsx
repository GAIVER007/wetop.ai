import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { beautyApi } from '../../lib/api';
import { currentMe, deskShell } from '../../lib/desk-shell';
import { mayBeautyAccess } from '../../lib/navigation';
import { requireFeature } from '../../lib/vertical-guard';
import { SalonHoursForm } from './hours-form';
import { SettingsLinks } from './settings-links';
import { BonusProgramForm, ReminderSettingsForm } from './loyalty-forms';
import './settings.css';

export default async function BeautySettingsPage() {
  await requireFeature('/beauty-settings');
  const me = await currentMe();
  const shell = await deskShell();
  try {
    const [initial, reminders, bonuses] = await Promise.all([
      beautyApi.locationHours(),
      beautyApi.reminderSettings(),
      beautyApi.bonusProgram(),
    ]);
    const canEdit =
      !shell.readOnly && mayBeautyAccess(shell.access, 'settings', 'update', { legacy: 'property' });
    const scopeKey = JSON.stringify({
      organizationId: me.user?.organizationId,
      businessId: me.context?.businessId,
      locationId: me.context?.locationId,
    });
    return (
      <Page title="Настройки салона" subtitle={initial.location.name ?? 'Выбранный филиал'}>
        <SettingsLinks />
        <div className="salon-settings-stack">
          <SalonHoursForm key={scopeKey} initial={initial} scopeKey={scopeKey} canEdit={canEdit} />
          <ReminderSettingsForm key={`r${scopeKey}`} initial={reminders} scopeKey={scopeKey} canEdit={canEdit} />
          <BonusProgramForm key={`b${scopeKey}`} initial={bonuses} scopeKey={scopeKey} canEdit={canEdit} />
        </div>
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title="Настройки салона">
        <LoadError testId="beauty-settings-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
