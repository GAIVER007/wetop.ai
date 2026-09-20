'use client';
import { useRouter } from 'next/navigation';
import { ErrorState } from '../../components/error-state';

/**
 * Список не пришёл (B5): заголовок, фильтры и адрес с датами остаются на месте, вместо строк —
 * экран сбоя со следующим шагом. «Повторить загрузку» перечитывает страницу с теми же условиями
 * (`router.refresh()`), не сбрасывая фильтры. `Error` собирается здесь: из серверного компонента в
 * клиентский он не передаётся.
 */
export function ReservationsLoadError({
  status,
  message,
}: {
  status: number | undefined;
  message: string;
}) {
  const router = useRouter();
  const error: Error & { digest?: string } = new Error(message);
  if (status) error.digest = `API_${status}`;
  return (
    <div data-testid="reservations-error">
      <ErrorState error={error} retry={() => router.refresh()} />
    </div>
  );
}
