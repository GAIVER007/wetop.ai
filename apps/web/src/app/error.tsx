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
        <h2>Связь с системой временно недоступна</h2>
        <p>Повторите загрузку. Если ошибка остаётся, проверьте доступность API хостела.</p>
        {error.digest && <p className="muted small">Код ошибки: {error.digest}</p>}
        <div className="row">
          <button className="btn" onClick={() => retry()}>
            Повторить загрузку
          </button>
          <Link href="/today" className="btn btn--secondary">
            К рабочему дню
          </Link>
        </div>
      </section>
    </Page>
  );
}
