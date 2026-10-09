import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { loadKitchen } from './load';
import { KitchenBoard } from './board';
import '../food/food.css';

/** Кухня FS1 (DATA_MODEL §33, ADR-KITCHEN-FS): меню, категории, стоп-лист филиала */
export default async function KitchenPage() {
  try {
    const data = await loadKitchen();
    return (
      <Page title="Кухня" subtitle="Меню, категории и доступность блюд">
        <div key={data.scopeKey}>
          <KitchenBoard data={data} />
        </div>
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title="Кухня">
        <LoadError testId="kitchen-load-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
