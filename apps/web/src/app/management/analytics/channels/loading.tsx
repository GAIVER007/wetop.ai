import { Page } from '../../../../components/page';
import { ChannelsSkeleton } from './channels';
import '../analytics.css';

/** Ожидание вкладки «Каналы» (ADR-141): заголовок сразу, под ним строки таблицы. */
export default function Loading() {
  return (
    <Page title="Аналитика">
      <ChannelsSkeleton />
    </Page>
  );
}
