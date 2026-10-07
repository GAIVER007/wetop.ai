'use client';
import { Button } from '../../../components/ui';
export default function SetupError() {
  return (
    <main id="main-content" className="onboarding setup-shell">
      <h1>Не удалось загрузить настройку</h1>
      <p role="alert">Проверьте связь и повторите загрузку. Сохранённый черновик не изменён.</p>
      <Button onClick={() => window.location.reload()}>Повторить загрузку</Button>
    </main>
  );
}
