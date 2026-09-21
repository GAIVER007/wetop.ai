import Link from 'next/link';
import { api } from '../../lib/api';
import { Page } from '../../components/page';
import { Icon } from '../../components/icon';
import { InventoryCatalog } from './inventory-catalog';
import './inventory.css';

/** Состав фонда из API; занятость и команды остаются в шахматке и карточке места. */
export default async function InventoryPage() {
  const [summary, units] = await Promise.all([api.inventorySummary(), api.inventoryUnits()]);
  return (
    <Page
      title="Номерной фонд"
      subtitle={summary.property.name}
      actions={
        <>
          <Link href="/rooms/availability" className="btn btn--secondary">
            Доступность
          </Link>
          <Link href="/chessboard" className="btn">
            <Icon name="board" />
            Шахматка
          </Link>
        </>
      }
    >
      <dl className="inventory-summary" data-testid="inventory-summary">
        {[
          ['В фонде', summary.totalUnits, 'total-units'],
          ['Номеров', summary.rooms, 'rooms'],
          ['Койко-мест', summary.beds, 'beds'],
          ['Максимум гостей', summary.maxGuests, 'max-guests'],
          ['Блокировок', summary.blocks, 'blocks'],
        ].map(([label, value, id]) => (
          <div key={id}>
            <dt>{label}</dt>
            <dd data-testid={id}>{value}</dd>
          </div>
        ))}
      </dl>
      <InventoryCatalog units={units} categories={summary.byCategory} />
    </Page>
  );
}
