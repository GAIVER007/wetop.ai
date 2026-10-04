import { Page } from '../../../../components/page';
import { UnitsSkeleton } from './units';
import '../analytics.css';

/** Ожидание вкладки «По номерам» (REP3): заголовок сразу, под ним строки таблицы. */
export default function Loading() {
  return (
    <Page title="Аналитика">
      <UnitsSkeleton />
    </Page>
  );
}
