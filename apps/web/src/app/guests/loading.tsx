import { Page } from '../../components/page';
import { LoadingState, Skeleton } from '../../components/ui';

/**
 * Ожидание экрана «Гости и бронирования» (B5, ТЗ «Гости v2» §41): заголовок появляется сразу, строки появляются, когда
 * придут. Скелетоны — форма будущей таблицы; о загрузке читалке говорит `LoadingState`.
 */
export default function Loading() {
  return (
    <Page title="Гости и бронирования" subtitle="Единая база гостей, бронирований и проживаний">
      <LoadingState label="Загружаем гостей…" data-testid="guests-loading">
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
