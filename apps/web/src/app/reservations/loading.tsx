import { serverT } from '../../i18n/server';
import { Page } from '../../components/page';
import { LoadingState, Skeleton } from '../../components/ui';

/**
 * Ожидание списка броней (B5): заголовок и место под фильтры и строки появляются сразу, данные —
 * когда придут. Скелетоны — форма будущего содержимого; о загрузке читалке говорит `LoadingState`.
 */
export default async function Loading() {
  const t = await serverT();
  return (
    <Page title={t('Брони')} width="full">
      <LoadingState label={t('Загружаем список броней…')} data-testid="reservations-loading">
        <Skeleton variant="row" />
        <Skeleton variant="text" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
      </LoadingState>
    </Page>
  );
}
