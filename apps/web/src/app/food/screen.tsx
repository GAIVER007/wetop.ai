import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { loadFood } from './load';
import { WorkspaceBoard } from './workspace-board';
import { CatalogBoard } from './catalog-board';
import './food.css';
export async function FoodScreen({
  kind,
  date,
  time,
}: {
  kind: 'floor' | 'list' | 'catalog';
  date?: string;
  time?: string;
}) {
  const title = kind === 'floor' ? 'План зала' : kind === 'list' ? 'Бронирования' : 'Залы и столы';
  try {
    const data = await loadFood(date, time, kind !== 'floor');
    return (
      <Page title={title} subtitle="Рабочее место ресторана">
        <div key={data.scopeKey}>
          {kind === 'catalog' ? (
            <CatalogBoard data={data} />
          ) : (
            <WorkspaceBoard data={data} floor={kind === 'floor'} />
          )}
        </div>
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title={title}>
        <LoadError testId="food-load-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
