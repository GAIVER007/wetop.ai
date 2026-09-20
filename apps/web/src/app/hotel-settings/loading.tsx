import { Page } from '../../components/page';
import { LoadingState, Skeleton } from '../../components/ui';

/** Ожидание настроек гостиницы (D4): заголовок раздела сразу, под ним строки будущих сведений. */
export default function Loading() {
  return (
    <Page title="Настройка гостиницы">
      <LoadingState label="Читаем настройки объекта…" data-testid="settings-loading">
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
      </LoadingState>
    </Page>
  );
}
