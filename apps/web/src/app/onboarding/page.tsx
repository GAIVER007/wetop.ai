import { redirect } from 'next/navigation';
import { onboardingApi } from '../../lib/api';
import { deskShell } from '../../lib/desk-shell';
import { mayAccess } from '../../lib/navigation';
import { Icon } from '../../components/icon';
import { Page } from '../../components/page';
import { EmptyState } from '../../components/ui';
import { OnboardingForm } from './onboarding-form';

/**
 * Онбординг нового отеля (plans/onboarding-2026-09-21.md). Сюда ведёт гейт, пока у объекта нет
 * номеров. Уже настроенный объект сюда не пускаем — незачем.
 */
export default async function OnboardingPage() {
  const [status, desk] = await Promise.all([onboardingApi.status().catch(() => null), deskShell()]);
  if (status && !status.needed) redirect('/today');
  // номера и цены заводят владелец и управляющий (ADR-100): администратору — не форма и не «Нет доступа», а кто и что
  if (!mayAccess(desk.access, 'settings'))
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
