import { Page } from '../../components/page';
import { LoadingState, Skeleton } from '../../components/ui';
import { msg } from '../../i18n';
import { T } from '../../i18n/locale-provider';

/** Ожидание разделов «Номера» (D4): заголовок сразу, под ним плитки и строки будущего содержимого. */
export default function Loading() {
  return (
    <Page title={<T text={msg('Номера')} />}>
      <LoadingState label={msg('Загружаем номерной фонд…')} data-testid="rooms-loading">
        <div className="stats">
          <Skeleton variant="stat" />
          <Skeleton variant="stat" />
          <Skeleton variant="stat" />
          <Skeleton variant="stat" />
        </div>
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </LoadingState>
    </Page>
  );
}
