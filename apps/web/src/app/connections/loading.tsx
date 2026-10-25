import { Page } from '../../components/page';
import { LoadingState, Skeleton } from '../../components/ui';
import { serverT } from '../../i18n/server';

/** Ожидание «Подключений» (D4): заголовок тот же, что у страницы, под ним место карточки подключения. */
export default async function Loading() {
  const t = await serverT();
  return (
    <Page title={t('Подключения')}>
      <LoadingState label={t('Проверяем подключения…')} data-testid="connections-loading">
        <Skeleton variant="row" />
        <Skeleton variant="row" />
      </LoadingState>
    </Page>
  );
}
