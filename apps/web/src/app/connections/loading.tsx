import { Page } from '../../components/page';
import { LoadingState, Skeleton } from '../../components/ui';

/** Ожидание «Подключений API» (D4): заголовок сразу, под ним панели будущих проверок. */
export default function Loading() {
  return (
    <Page title="Подключения API">
      <LoadingState label="Проверяем базу, Channex и сайт…" data-testid="connections-loading">
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
      </LoadingState>
    </Page>
  );
}
