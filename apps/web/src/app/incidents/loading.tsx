import { msg } from '../../i18n';
import { T } from '../../i18n/locale-provider';
import { Page } from '../../components/page';
import { LoadingState, Skeleton } from '../../components/ui';

/** Ожидание «Неисправностей» (D4): заголовок сразу, под ним плитки сторожа и строки таблиц. */
export default function Loading() {
  return (
    <Page title={<T text={msg('Неисправности')} />}>
      <LoadingState
        label={msg('Читаем состояние сторожа и список неисправностей…')}
        data-testid="incidents-loading"
      >
        <div className="stats">
          <Skeleton variant="stat" />
          <Skeleton variant="stat" />
          <Skeleton variant="stat" />
        </div>
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
      </LoadingState>
    </Page>
  );
}
