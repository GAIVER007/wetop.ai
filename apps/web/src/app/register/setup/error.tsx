'use client';
import { ErrorState } from '../../../components/error-state';
export default function SetupError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main id="main-content" className="onboarding setup-shell">
    <h1>Настройка бизнеса</h1>
    <ErrorState error={error} retry={reset} title="Не удалось загрузить настройку" />
  </main>;
}
