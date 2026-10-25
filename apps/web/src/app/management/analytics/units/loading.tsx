import { Page } from '../../../../components/page';
import { UnitsSkeleton } from './units';
import '../analytics.css';
import { msg } from '../../../../i18n';
import { T } from '../../../../i18n/locale-provider';

/** Ожидание вкладки «По номерам» (REP3): заголовок сразу, под ним строки таблицы. */
export default function Loading() {
  return (
    <Page title={<T text={msg('Аналитика')} />}>
      <UnitsSkeleton />
    </Page>
  );
}
