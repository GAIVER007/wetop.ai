'use client';
import { ErrorState } from '../../../components/error-state';
import { useT } from '../../../i18n/locale-provider';
export default function SetupError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  return <main id="main-content" className="onboarding setup-shell">
    <h1>{t('Настройка бизнеса')}</h1>
    <ErrorState error={error} retry={reset} title={t('Не удалось загрузить настройку')} />
  </main>;
}
