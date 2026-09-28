import { Page } from '../../../components/page';
import { LoadingState, Skeleton } from '../../../components/ui';

/** Ожидание страницы Channex (INT2): заголовок сразу, проверка объекта идёт в Channex живьём */
export default function Loading() {
  return (
    <Page title="Channex">
      <LoadingState label="Проверяем соединение с Channex…" data-testid="channex-loading">
        <Skeleton variant="row" />
        <Skeleton variant="row" />
      </LoadingState>
    </Page>
  );
}
