import { redirect, unstable_rethrow } from 'next/navigation';
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

export default async function BeautySettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section } = await searchParams;
  if (section !== 'hours' && section !== 'reminders' && section !== 'bonuses') redirect('/settings');
  await requireFeature('/beauty-settings');
  const me = await currentMe();
  const shell = await deskShell();
  const t = await serverT();
  const title =
    section === 'hours' ? t('Режим работы салона') : section === 'reminders' ? t('Напоминания клиентам') : t('Бонусы');
  try {
    const initial = section === 'hours' ? await beautyApi.locationHours() : null;
    const reminders = section === 'reminders' ? await beautyApi.reminderSettings() : null;
    const bonuses = section === 'bonuses' ? await beautyApi.bonusProgram() : null;
    const canEdit =
      !shell.readOnly && mayBeautyAccess(shell.access, 'settings', 'update', { legacy: 'property' });
    const scopeKey = JSON.stringify({
      organizationId: me.user?.organizationId,
      businessId: me.context?.businessId,
      locationId: me.context?.locationId,
    });
    return (
      <Page title={title} subtitle={initial?.location.name ?? t('Выбранный филиал')}>
        <SettingsLinks />
        {initial && <SalonHoursForm key={scopeKey} initial={initial} scopeKey={scopeKey} canEdit={canEdit} />}
        {reminders && <ReminderSettingsForm key={`r${scopeKey}`} initial={reminders} scopeKey={scopeKey} canEdit={canEdit} />}
        {bonuses && <BonusProgramForm key={`b${scopeKey}`} initial={bonuses} scopeKey={scopeKey} canEdit={canEdit} />}
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title={title}>
        <LoadError testId="beauty-settings-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
