import { Page } from '../../../../components/page';
import { ChannelsSkeleton } from './channels';
import '../analytics.css';
import { msg } from '../../../../i18n';
import { T } from '../../../../i18n/locale-provider';

/** Ожидание вкладки «Каналы» (ADR-141): заголовок сразу, под ним строки таблицы. */
export default function Loading() {
  return (
    <Page title={<T text={msg('Аналитика')} />}>
      <ChannelsSkeleton />
    </Page>
  );
}
