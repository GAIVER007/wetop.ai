import { Page } from '../../../components/page';
import { LoadingState, Skeleton } from '../../../components/ui';
import { serverT } from '../../../i18n/server';

/** Ожидание «Каналов продаж» (D4): заголовок сразу, под ним плитки состояния и строки таблиц. */
export default async function Loading() {
  const t = await serverT();
  return (
    <Page title={t('Каналы продаж')}>
      <LoadingState
        label={t('Загружаем состояние обмена с каналами…')}
        data-testid="channels-loading"
      >
        <div className="stats">
          <Skeleton variant="stat" />
          <Skeleton variant="stat" />
          <Skeleton variant="stat" />
        </div>
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
      </LoadingState>
    </Page>
  );
}
