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
import { serverT } from '../../i18n/server';
import './settings.css';

export default async function BeautySettingsPage() {
  await requireFeature('/beauty-settings');
  const me = await currentMe();
  const shell = await deskShell();
  const t = await serverT();
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
      <Page title={t('Настройки салона')} subtitle={initial.location.name ?? t('Выбранный филиал')}>
        <SettingsLinks />
        {/* компактно (поручение 21.10.2026): режим работы слева, напоминания и бонусы справа; на телефоне столбиком */}
        <div className="salon-settings-stack">
          <div className="salon-settings-col" id="hours">
            <SalonHoursForm key={scopeKey} initial={initial} scopeKey={scopeKey} canEdit={canEdit} />
          </div>
          <div className="salon-settings-col">
            <div id="reminders">
              <ReminderSettingsForm key={`r${scopeKey}`} initial={reminders} scopeKey={scopeKey} canEdit={canEdit} />
            </div>
            <div id="bonuses">
              <BonusProgramForm key={`b${scopeKey}`} initial={bonuses} scopeKey={scopeKey} canEdit={canEdit} />
            </div>
          </div>
        </div>
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title={t('Настройки салона')}>
        <LoadError testId="beauty-settings-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
