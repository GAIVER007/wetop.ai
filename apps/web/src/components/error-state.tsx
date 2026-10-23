'use client';
import Link from 'next/link';
import { Icon } from './icon';
import { EmptyState } from './ui';
import { apiErrorStatus } from '../lib/api-error';
import { useDeskVertical } from './desk-access';

/**
 * Общий экран ошибки для оболочки и выезжающей карточки. Отклонённый запрос (400/404/422 — неверная дата
 * или адрес) и отсутствие связи (503, обрыв) — разные советы: повтор не поможет, если неверен адрес.
 * Разметку держит `EmptyState` (MV8.5 DS1c): второй копии `.empty-state` здесь нет.
 */
export function ErrorState({
  error,
  retry,
  title,
}: {
  error: Error & { digest?: string };
  retry: () => void;
  /** Что именно не загрузилось («Не удалось загрузить гостей», ТЗ «Гости v2» §43); без него — как было */
  title?: string | undefined;
}) {
  const status = apiErrorStatus(error.digest);
  // Нет прав (аудит 22.10.2026, P1-2): один понятный текст, без кода, «Подключений» и повтора — тот же
  // запрос с теми же правами даст тот же отказ
  const denied = status === 403;
  const rejected = status !== undefined && status >= 400 && status < 500 && !denied;
  // «Подключения» есть только у гостиницы (Channex): салону и ресторану ссылка увела бы на «Главную»
  const hotel = useDeskVertical() === 'HOSPITALITY';
  if (denied)
    return (
      <EmptyState role="alert" icon={<Icon name="lock" width={32} height={32} />} title={title}>
        {FORBIDDEN_TEXT}
      </EmptyState>
    );
  return (
    <EmptyState
      role="alert"
      icon={<Icon name="channels" width={32} height={32} />}
      title={title}
      details={
        error.digest && (
          <details>
            <summary>Код ошибки</summary>
            {error.digest}
          </details>
        )
      }
      actions={
        <>
          <button className="btn" onClick={() => retry()}>
            Повторить загрузку
          </button>
          {!rejected && hotel && (
            <Link href="/connections" className="btn btn--secondary">
              Подключения
            </Link>
          )}
        </>
      }
    >
      {rejected
        ? 'Сервер не принял запрос: проверьте адрес страницы и даты в нём. Повтор с теми же данными даст тот же ответ.'
        : 'Проверьте подключение и повторите запрос.'}
    </EmptyState>
  );
}

/** Текст отказа в доступе: тот же, что на экране ошибки макета (`app/layout.tsx`). */
export const FORBIDDEN_TEXT = 'Этот раздел вам недоступен. Попросите руководителя открыть доступ.';
