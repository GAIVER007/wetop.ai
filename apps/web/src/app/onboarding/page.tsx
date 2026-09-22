import { redirect } from 'next/navigation';
import { onboardingApi } from '../../lib/api';
import { OnboardingForm } from './onboarding-form';

/**
 * Онбординг нового отеля (plans/onboarding-2026-09-21.md). Сюда ведёт гейт, пока у объекта нет
 * номеров. Уже настроенный объект сюда не пускаем — незачем.
 */
export default async function OnboardingPage() {
  const status = await onboardingApi.status().catch(() => null);
  if (status && !status.needed) redirect('/today');
  return <OnboardingForm hotelName={status?.name ?? ''} currency={status?.currency ?? 'KZT'} />;
}
