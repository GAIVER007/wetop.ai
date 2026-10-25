import { Page } from '../../components/page';
import { LoadingState, Skeleton } from '../../components/ui';
import { msg } from '../../i18n';
import { T } from '../../i18n/locale-provider';
import './settings.css';

/** Ожидание настроек объекта (D4): заголовок раздела сразу, под ним строки будущих сведений. */
export default function Loading() {
  return (
    <Page title={<T text={msg('Настройки объекта')} />}>
      <LoadingState label={msg('Читаем настройки объекта…')} data-testid="settings-loading">
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
      </LoadingState>
    </Page>
  );
}
