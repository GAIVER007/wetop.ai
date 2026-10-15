import { Page } from '../../../components/page';
import { LoadingState, Skeleton } from '../../../components/ui';

/** Ожидание «Подключения каналов»: заголовок тот же, что у страницы, проверка объекта идёт в Channex живьём */
export default function Loading() {
  return (
    <Page title="Подключение каналов">
      <LoadingState label="Проверяем соединение с менеджером каналов…" data-testid="channex-loading">
        <Skeleton variant="row" />
        <Skeleton variant="row" />
      </LoadingState>
    </Page>
  );
}
