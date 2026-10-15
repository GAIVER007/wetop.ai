'use client';
import Link from 'next/link';
import { Icon } from './icon';
import { EmptyState } from './ui';
import { apiErrorStatus } from '../lib/api-error';

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
  const rejected = status !== undefined && status >= 400 && status < 500;
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
          {!rejected && (
            <Link href="/connections" className="btn btn--secondary">
              Подключения API
            </Link>
          )}
        </>
      }
    >
      {rejected
        ? `Сервер отклонил запрос (код ${status}): проверьте адрес страницы и даты в нём. Повтор с теми же данными даст тот же ответ.`
        : 'Проверьте подключение и повторите запрос.'}
    </EmptyState>
  );
}
