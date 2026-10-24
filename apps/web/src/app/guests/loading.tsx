import { Page } from '../../components/page';
import { LoadingState, Skeleton } from '../../components/ui';
import { serverT } from '../../i18n/server';

/**
 * Ожидание экрана «Гости и бронирования» (B5, ТЗ «Гости v2» §41): заголовок появляется сразу, строки появляются, когда
 * придут. Скелетоны — форма будущей таблицы; о загрузке читалке говорит `LoadingState`.
 */
export default async function Loading() {
  const t = await serverT();
  return (
    <Page title={t('Гости и бронирования')} subtitle={t('Единая база гостей, бронирований и проживаний')}>
      <LoadingState label={t('Загружаем гостей…')} data-testid="guests-loading">
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
