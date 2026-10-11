import { requireVertical } from '../../lib/vertical-guard';
import { FundTabs } from './fund-tabs';
import './fund.css';
import Link from 'next/link';
import { api, inventoryEditorApi } from '../../lib/api';
import { Page } from '../../components/page';
import { Icon } from '../../components/icon';
import { pluralRu } from '../../lib/plural';
import { AddMenu } from './add-menu';
import { channelMarks } from './channel-marks';
import { InventoryCatalog } from './inventory-catalog';
import { InventorySummaryTiles } from './summary-tiles';
import './inventory.css';

/** Состав фонда из API; занятость и команды остаются в календаре и карточке места. */
export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireVertical(['HOSPITALITY']);
  const period = Number((await searchParams).period);
  const days = period === 7 || period === 90 ? period : 30;
  const [summary, units, categories, trend, occupancy, marks] = await Promise.all([
    api.inventorySummary(),
    api.inventoryUnits(),
    inventoryEditorApi.categories(),
    api.inventoryTrend(days).catch(() => null),
    api.inventoryOccupancy().catch(() => []),
    channelMarks(),
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
          <Link href="/rooms/categories" className="btn btn--secondary">
            <Icon name="rates" />
            Категории
          </Link>
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
      <InventorySummaryTiles units={units} trend={trend} days={days} />
      <InventoryCatalog
        units={units}
        categories={summary.byCategory}
        editorCategories={categories}
        occupancy={occupancy}
        channels={marks.channels}
        channelCategories={marks.mapped}
      />
    </Page>
  );
}
