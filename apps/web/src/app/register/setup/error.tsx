'use client';
import { Button } from '../../../components/ui';
export default function SetupError({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" className="onboarding setup-shell">
      <h1>Не удалось загрузить настройку</h1>
      <p role="alert">Проверьте связь и повторите загрузку. Сохранённый черновик не изменён.</p>
      <Button onClick={reset}>Повторить загрузку</Button>
    </main>
  );
}
