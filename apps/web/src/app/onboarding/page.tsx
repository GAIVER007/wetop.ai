import { requireVertical } from '../../lib/vertical-guard';
import { redirect } from 'next/navigation';
import { authApi, onboardingApi } from '../../lib/api';
import { deskShell } from '../../lib/desk-shell';
import { pageOpen } from '../../lib/navigation';
import { Icon } from '../../components/icon';
import { Page } from '../../components/page';
import { EmptyState } from '../../components/ui';
import { OnboardingForm } from './onboarding-form';

/**
 * Онбординг нового отеля (plans/onboarding-2026-09-21.md). Сюда ведёт гейт, пока у объекта нет
 * номеров. Уже настроенный объект сюда не пускаем — незачем.
 */
export default async function OnboardingPage() {
  await requireVertical(['HOSPITALITY']);
  const verified = await authApi.me().catch(() => null);
  if (verified?.context?.businessId && verified.context.locationId) redirect('/register/setup');
  const [status, desk] = await Promise.all([onboardingApi.status().catch(() => null), deskShell()]);
  if (status && !status.needed) redirect('/today');
  // номера и цены заводят владелец и управляющий (ADR-107): администратору — не форма и не «Нет доступа», а кто и что;
  // роль не узнали — форма: отправку без права отклонит API
  if (!pageOpen(desk.access, 'settings'))
    return (
      <Page title="Отель ещё не настроен">
        <EmptyState
          data-testid="onboarding-waiting"
          icon={<Icon name="settings" width={32} height={32} />}
          title="Ждём первичной настройки"
        >
          В отеле ещё нет номеров, поэтому работать со стойкой пока нельзя: настройку делают
          владелец и управляющий. Как только они заведут номера и цены, здесь откроется рабочее
          место.
        </EmptyState>
      </Page>
    );
  return <OnboardingForm hotelName={status?.name ?? ''} currency={status?.currency ?? 'KZT'} />;
}
