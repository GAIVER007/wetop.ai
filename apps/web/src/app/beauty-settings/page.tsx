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
import './settings.css';

export default async function BeautySettingsPage() {
  await requireFeature('/beauty-settings');
  const me = await currentMe();
  const shell = await deskShell();
  try {
    const initial = await beautyApi.locationHours();
    const scopeKey = JSON.stringify({
      organizationId: me.user?.organizationId,
      businessId: me.context?.businessId,
      locationId: me.context?.locationId,
    });
    return (
      <Page title="Настройки салона" subtitle={initial.location.name ?? 'Выбранный филиал'}>
        <SettingsLinks />
        <SalonHoursForm
          key={scopeKey}
          initial={initial}
          scopeKey={scopeKey}
          canEdit={
            !shell.readOnly &&
            mayBeautyAccess(shell.access, 'settings', 'update', { legacy: 'property' })
          }
        />
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
