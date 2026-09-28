import { Page } from '../../../../components/page';
import { OccupancySkeleton } from './occupancy';
import '../analytics.css';

/** Ожидание вкладки «Загрузка» (бывшая «Статистика», D4): заголовок сразу, под ним плитки и строки категорий. */
export default function Loading() {
  return (
    <Page title="Аналитика">
      <OccupancySkeleton />
    </Page>
  );
}
