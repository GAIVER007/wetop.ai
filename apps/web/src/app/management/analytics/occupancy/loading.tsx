import { Page } from '../../../../components/page';
import { OccupancySkeleton } from './occupancy';
import '../analytics.css';
import { msg } from '../../../../i18n';
import { T } from '../../../../i18n/locale-provider';

/** Ожидание вкладки «Загрузка» (бывшая «Статистика», D4): заголовок сразу, под ним плитки и строки категорий. */
export default function Loading() {
  return (
    <Page title={<T text={msg('Аналитика')} />}>
      <OccupancySkeleton />
    </Page>
  );
}
