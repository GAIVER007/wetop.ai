'use client';
import Link from 'next/link';
import { Page } from '../components/page';
import { Icon } from '../components/icon';
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <Page title="Не удалось загрузить данные" width="narrow">
      <section className="empty-state" role="alert">
        <Icon name="channels" width={32} height={32} />
        <p>Проверьте подключение и повторите запрос.</p>
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
          <Link href="/connections" className="btn btn--secondary">
            Подключения API
          </Link>
        </div>
      </section>
    </Page>
  );
}
