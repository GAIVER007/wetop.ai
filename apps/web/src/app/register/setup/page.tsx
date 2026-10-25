import { landingForVertical } from '../../../lib/vertical-landing';
import { can } from '@pms/domain';
import { LoadError } from '../../../components/load-error';
import { loadErrorProps } from '../../../lib/load-error';
import { redirect, unstable_rethrow } from 'next/navigation';
import { sharedOnboardingApi, onboardingApi, authApi, beautyApi } from '../../../lib/api';
import { bookingPreview } from './setup-path';
import { publicAuthUrl } from '../../../lib/auth-entry';
import { signedInUser } from '../../login/signed-in';
import { OnboardingShell } from './shell';
import '../../onboarding/onboarding.css';
import './setup.css';
import { translator } from '../../../i18n';
import { cookieLocale } from '../../../i18n/server';

export async function generateMetadata() {
  const t = translator(await cookieLocale());
  return { title: t('Настройка бизнеса WETOP') };
}

export default async function SetupPage({
  searchParams = Promise.resolve({}),
}: { searchParams?: Promise<{ entry?: string }> } = {}) {
  const { entry } = await searchParams;
  const user = await signedInUser();
  if (!user) redirect(publicAuthUrl());
  const { context } = await authApi.me();
  if (!context?.businessId || !context.locationId) redirect('/register/complete');
  const loaded = await sharedOnboardingApi.status().then(
    (state) => ({ state, error: null }),
    (error) => {
      unstable_rethrow(error);
      return { state: null, error };
    },
  );
  const t = translator(await cookieLocale());
  if (!loaded.state)
    return (
      <main id="main-content" className="onboarding setup-shell">
        <h1>{t('Настройка бизнеса')}</h1>
        <LoadError testId="onboarding-load-error" {...loadErrorProps(loaded.error)} />
      </main>
    );
  const state = loaded.state;
  if (state.vertical === 'BEAUTY' && !can(user.role ?? 'STAFF', 'settings')) redirect('/today');
  if (state.vertical === 'FOOD_SERVICE' && state.completedAt)
    redirect(landingForVertical(state.vertical));
  if (
    state.vertical === 'BEAUTY' &&
    state.readiness?.ready &&
    (state.storedFlowVersion !== 2 || (state.completedFlowVersion === 2 && entry === '1'))
  )
    redirect(landingForVertical(state.vertical));
  const hotel = state.vertical === 'HOSPITALITY' ? await onboardingApi.status() : null;
  // превью онлайн-записи (вариант B, 21.10.2026): необязательно, без прав или при ошибке шаги работают без него
  const preview =
    state.vertical === 'BEAUTY' && state.profileApplied
      ? await Promise.all([beautyApi.services(), beautyApi.employees()]).then(
          ([services, employees]) => bookingPreview(services.items, employees.items, state.locationId),
          (error) => {
            unstable_rethrow(error);
            return null;
          },
        )
      : null;
  if (hotel && !hotel.needed) redirect('/today');
  return (
    <OnboardingShell
      key={`${state.businessId}:${state.locationId}`}
      initial={state}
      hotel={hotel}
      preview={preview}
    />
  );
}
