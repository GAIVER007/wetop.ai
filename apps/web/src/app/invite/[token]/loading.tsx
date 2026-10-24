import { LoadingState, Skeleton } from '../../../components/ui';
import { msg } from '../../../i18n';

/** Ожидание страницы приглашения (D4): та же рамка входа, внутри — подпись словом и строки. */
export default function Loading() {
  return (
    <main className="login-page login-page--single" id="main-content">
      <section className="login-form-panel">
        <div className="login-form">
          <LoadingState label={msg('Проверяем приглашение…')} data-testid="invite-loading">
            <Skeleton variant="title" />
            <Skeleton variant="text" />
            <Skeleton variant="text" />
          </LoadingState>
        </div>
      </section>
    </main>
  );
}
