import Link from 'next/link';
import { Badge } from '../../components/ui';
import { Icon } from '../../components/icon';
import { pluralRu } from '../../lib/plural';

export interface WarehouseCard {
  id: 'bar' | 'kitchen';
  title: string;
  href: string;
  /** активных позиций; null, если склад не прочитался */
  items: number | null;
  /** позиций, которые заканчиваются или закончились */
  low: number;
  /** сумма остатков словами валюты; null, если её нет (у бара остаток считается по штукам) */
  value: string | null;
}

/**
 * «Остатки по складам»: бар и кухня (у салона расходники) рядом, у всех направлений одинаково. Показывает наличие
 * и то, что заканчивается; сами остатки и операции на экране склада по ссылке (ADR-STOCK-ALL, 21.10.2026).
 */
export function WarehouseSummary({ cards }: { cards: WarehouseCard[] }) {
  return (
    <section className="bar-warehouses" aria-label="Остатки по складам">
      {cards.map((card) => (
        <Link key={card.id} href={card.href} prefetch={false} className="panel bar-warehouse" data-warehouse={card.id}>
          <span className="bar-warehouse-head">
            <Icon name={card.id === 'bar' ? 'receipt' : 'stock'} width={20} height={20} />
            <b>{card.title}</b>
            {card.items === null ? (
              <Badge tone="neutral">Нет данных</Badge>
            ) : card.low > 0 ? (
              <Badge tone="warn">{`Заканчивается: ${card.low}`}</Badge>
            ) : (
              <Badge tone="ok">В норме</Badge>
            )}
          </span>
          <span className="bar-warehouse-body">
            {card.items === null
              ? 'Остатки не загрузились'
              : `${card.items} ${pluralRu(card.items, ['позиция', 'позиции', 'позиций'], false)}`}
            {card.value ? ` на ${card.value}` : ''}
          </span>
        </Link>
      ))}
    </section>
  );
}
