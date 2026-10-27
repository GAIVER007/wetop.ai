import { redirect } from 'next/navigation';
import { can } from '@pms/domain';
import { authApi, sharedOnboardingApi } from '../../../../lib/api';
import { publicAuthUrl } from '../../../../lib/auth-entry';
import { signedInUser } from '../../../login/signed-in';
import { translator } from '../../../../i18n';
import { cookieLocale } from '../../../../i18n/server';
import { QuickStartBoard } from './board';
import '../../../onboarding/onboarding.css';
import '../setup.css';
import './quick.css';

/** Быстрый запуск салона (владелец 27.10.2026): анкета в одном окне и одна кнопка «Создать салон» */
export async function generateMetadata() {
  const t = translator(await cookieLocale());
  return { title: t('Запуск салона') };
}

export default async function QuickStartPage() {
  const user = await signedInUser();
  if (!user) redirect(publicAuthUrl());
  const { context } = await authApi.me();
  if (!context?.businessId || !context.locationId) redirect('/register/complete');
  const state = await sharedOnboardingApi.status();
  // только салон и только тот, кто настраивает (владелец, управляющий); остальные идут обычным путём
  if (state.vertical !== 'BEAUTY' || !can(user.role ?? 'STAFF', 'settings') || !state.canEdit)
    redirect('/register/setup');
  const t = translator(await cookieLocale());
  return (
    <main id="main-content" className="onboarding quick-shell">
      <h1>{t('Запустим салон за 5 минут')}</h1>
      <QuickStartBoard
        currency={String(state.draft.currency ?? 'QAR')}
        timezone={String(state.draft.timezone ?? 'Asia/Qatar')}
        name={String(state.draft.businessName ?? '')}
      />
    </main>
  );
}
