import { requireFeature } from '../../lib/vertical-guard';
import { redirect } from 'next/navigation';
import { authApi, onboardingApi } from '../../lib/api';
import { deskShell } from '../../lib/desk-shell';
import { pageOpen } from '../../lib/navigation';
import { Icon } from '../../components/icon';
import { Page } from '../../components/page';
import { EmptyState } from '../../components/ui';
import { OnboardingForm } from './onboarding-form';
import { serverT } from '../../i18n/server';

/**
 * Онбординг нового отеля (plans/onboarding-2026-09-21.md). Сюда ведёт гейт, пока у объекта нет
 * номеров. Уже настроенный объект сюда не пускаем — незачем.
 */
export default async function OnboardingPage() {
  await requireFeature('/onboarding');
  const [verified, status, desk] = await Promise.all([
    authApi.me().catch(() => null),
    onboardingApi.status().catch(() => null),
    deskShell(),
  ]);
  if (status && !status.needed) redirect('/today');
  // Общий экран настройки (MV3) открывается только тем, кто вправе настраивать: после входа филиал выбран сразу
  // (SCOPE-HARDENING), и администратор не должен попадать в форму, которую отклонит API
  if (
    pageOpen(desk.access, 'settings') &&
    verified?.context?.businessId &&
    verified.context.locationId
  )
    redirect('/register/setup');
  // номера и цены заводят владелец и управляющий (ADR-107): администратору — не форма и не «Нет доступа», а кто и что;
  // роль не узнали — форма: отправку без права отклонит API
  const t = await serverT();
  if (!pageOpen(desk.access, 'settings'))
    return (
      <Page title={t('Отель ещё не настроен')}>
        <EmptyState
          data-testid="onboarding-waiting"
          icon={<Icon name="settings" width={32} height={32} />}
          title={t('Ждём первичной настройки')}
        >
          {t(
            'В отеле ещё нет номеров, поэтому работать со стойкой пока нельзя: настройку делают владелец и управляющий. Как только они заведут номера и цены, здесь откроется рабочее место.',
          )}
        </EmptyState>
      </Page>
    );
  return <OnboardingForm hotelName={status?.name ?? ''} currency={status?.currency ?? 'KZT'} />;
}
