'use client';
import Link from 'next/link';
import { Icon } from './icon';
import { apiErrorStatus } from '../lib/api-error';

/**
 * Общий экран ошибки для оболочки и выезжающей карточки. Отклонённый запрос (400/404/422 — неверная дата
 * или адрес) и отсутствие связи (503, обрыв) — разные советы: повтор не поможет, если неверен адрес.
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
    <section className="empty-state" role="alert">
      <Icon name="channels" width={32} height={32} />
      {title && <h3 className="empty-state__title">{title}</h3>}
      {rejected ? (
        <p>
          Сервер отклонил запрос (код {status}): проверьте адрес страницы и даты в нём. Повтор с
          теми же данными даст тот же ответ.
        </p>
      ) : (
        <p>Проверьте подключение и повторите запрос.</p>
      )}
      {error.digest && (
        <details>
          <summary>Код ошибки</summary>
          {error.digest}
        </details>
      )}
      <div className="row">
        <button className="btn" onClick={() => retry()}>
          Повторить загрузку
        </button>
        {!rejected && (
          <Link href="/connections" className="btn btn--secondary">
            Подключения API
          </Link>
        )}
      </div>
    </section>
  );
}
