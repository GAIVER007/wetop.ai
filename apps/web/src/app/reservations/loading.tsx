import { Page } from '../../components/page';
import { LoadingState, Skeleton } from '../../components/ui';

/**
 * Ожидание списка броней (B5): заголовок и место под фильтры и строки появляются сразу, данные —
 * когда придут. Скелетоны — форма будущего содержимого; о загрузке читалке говорит `LoadingState`.
 */
export default function Loading() {
  return (
    <Page title="Брони" subtitle="Бронирования и проживания в выбранном периоде">
      <LoadingState label="Загружаем список броней…" data-testid="reservations-loading">
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
