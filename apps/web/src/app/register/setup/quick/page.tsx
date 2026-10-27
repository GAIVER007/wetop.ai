import { redirect } from 'next/navigation';
import { can } from '@pms/domain';
import { authApi, onboardingApi, sharedOnboardingApi } from '../../../../lib/api';
import { publicAuthUrl } from '../../../../lib/auth-entry';
import { signedInUser } from '../../../login/signed-in';
import { translator } from '../../../../i18n';
import { cookieLocale } from '../../../../i18n/server';
import { QuickStartBoard } from './board';
import { QuickHotelBoard, QuickRestaurantBoard } from './vertical-board';
import '../../../onboarding/onboarding.css';
import '../setup.css';
import './quick.css';

/** Быстрый запуск (владелец 27.10.2026): анкета в одном окне и одна кнопка «Создать», салон, гостиница, ресторан */
export async function generateMetadata() {
  const t = translator(await cookieLocale());
  return { title: t('Быстрый запуск') };
}

export default async function QuickStartPage() {
  const user = await signedInUser();
  if (!user) redirect(publicAuthUrl());
  const { context } = await authApi.me();
  if (!context?.businessId || !context.locationId) redirect('/register/complete');
  const state = await sharedOnboardingApi.status();
  // только тот, кто настраивает (владелец, управляющий); остальные идут обычным путём
  if (!can(user.role ?? 'STAFF', 'settings') || !state.canEdit) redirect('/register/setup');
  const t = translator(await cookieLocale());
  const currency = String(state.draft.currency ?? 'QAR');
  const timezone = String(state.draft.timezone ?? 'Asia/Qatar');
  const name = String(state.draft.businessName ?? '');
  if (state.vertical === 'HOSPITALITY') {
    const hotel = await onboardingApi.status();
    return (
      <main id="main-content" className="onboarding quick-shell">
        <h1>{t('Запустим гостиницу за 5 минут')}</h1>
        <QuickHotelBoard currency={hotel.currency || currency} name={hotel.name || name} />
      </main>
    );
  }
  if (state.vertical === 'FOOD_SERVICE') {
    // завершённую настройку окно не сбрасывает: после «Создать» здесь же показывается итог «Ресторан готов»
    return (
      <main id="main-content" className="onboarding quick-shell">
        <h1>{t('Запустим ресторан за 5 минут')}</h1>
        <QuickRestaurantBoard currency={currency} timezone={timezone} name={name} />
      </main>
    );
  }
  if (state.vertical !== 'BEAUTY') redirect('/register/setup');
  return (
    <main id="main-content" className="onboarding quick-shell">
      <h1>{t('Запустим салон за 5 минут')}</h1>
      <QuickStartBoard currency={currency} timezone={timezone} name={name} />
    </main>
  );
}
