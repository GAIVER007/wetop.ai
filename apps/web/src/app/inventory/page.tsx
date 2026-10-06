import { requireVertical } from '../../lib/vertical-guard';
import { FundTabs } from './fund-tabs';
import './fund.css';
import Link from 'next/link';
import { api, inventoryEditorApi } from '../../lib/api';
import { Page } from '../../components/page';
import { Icon } from '../../components/icon';
import { pluralRu } from '../../lib/plural';
import { AddMenu } from './add-menu';
import { InventoryCatalog } from './inventory-catalog';
import './inventory.css';

/** Состав фонда из API; занятость и команды остаются в календаре и карточке места. */
export default async function InventoryPage() {
  await requireVertical(['HOSPITALITY']);
  const [summary, units, categories] = await Promise.all([
    api.inventorySummary(),
    api.inventoryUnits(),
    inventoryEditorApi.categories(),
  ]);
  return (
    <Page
      title="Номерной фонд"
      subtitle={
        summary.totalUnits
          ? `${summary.property.name}, ${pluralRu(summary.totalUnits, ['место', 'места', 'мест'])}`
          : summary.property.name
      }
      actions={
        <>
          <AddMenu categories={categories} />
          <Link href="/chessboard" className="btn btn--secondary">
            <Icon name="board" />
            Календарь
          </Link>
        </>
      }
    >
      <FundTabs active="inventory" />
      {!summary.totalUnits && (
        <section className="fund-empty">
          <h2>Создайте свой номерной фонд</h2>
          <ol>
            <li>Добавьте категорию</li>
            <li>Создайте номера или койки</li>
            <li>Настройте тарифы</li>
          </ol>
        </section>
      )}
      <dl className="inventory-summary" data-testid="inventory-summary">
        {[
          ['Единиц продажи', summary.totalUnits, 'total-units'],
          ['Номеров', summary.rooms, 'rooms'],
          ['Койко-мест', summary.beds, 'beds'],
          ['Вместимость', summary.maxGuests, 'max-guests'],
          ['Недоступно', summary.blocks, 'blocks'],
        ].map(([label, value, id]) => (
          <div key={id}>
            <dt>{label}</dt>
            <dd data-testid={id}>{value}</dd>
          </div>
        ))}
      </dl>
      <InventoryCatalog
        units={units}
        categories={summary.byCategory}
        editorCategories={categories}
      />
    </Page>
  );
}
