import { redirect } from 'next/navigation';
import { sharedOnboardingApi, onboardingApi, authApi } from '../../../lib/api';
import { publicAuthUrl } from '../../../lib/auth-entry';
import { signedInUser } from '../../login/signed-in';
import { OnboardingShell } from './shell';
import '../../onboarding/onboarding.css';
import './setup.css';
export const metadata = { title: 'Настройка бизнеса WETOP' };

export default async function SetupPage() {
  if (!(await signedInUser())) redirect(publicAuthUrl());
  const { context } = await authApi.me();
  if (!context?.businessId || !context.locationId) redirect('/register/complete');
  const state = await sharedOnboardingApi.status();
  if (state.vertical === 'BEAUTY' && state.completedAt) redirect('/calendar');
  const hotel = state.vertical === 'HOSPITALITY' ? await onboardingApi.status() : null;
  if (hotel && !hotel.needed) redirect('/today');
  return <OnboardingShell initial={state} hotel={hotel} />;
}
