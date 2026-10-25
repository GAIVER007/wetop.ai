import { msg } from '../../i18n';
import { Page } from '../../components/page';
import { T } from '../../i18n/locale-provider';
import { LoadingState, Skeleton } from '../../components/ui';

/** Ожидание журнала действий (D4): заголовок сразу, под ним строки будущей таблицы. */
export default function Loading() {
  return (
    <Page title={<T text={msg('История действий')} />}>
      <LoadingState label={msg('Загружаем журнал действий…')} data-testid="journal-loading">
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
      </LoadingState>
    </Page>
  );
}
