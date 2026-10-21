import Link from 'next/link';
import { Badge } from '../../components/ui';
import { Icon } from '../../components/icon';
import { pluralRu } from '../../lib/plural';

export interface WarehouseCard {
  id: 'bar' | 'kitchen';
  title: string;
  /** куда ведёт карточка: экран самого склада */
  href: string;
  /** слово для позиции склада: «товар» у бара, «продукт» у кухни */
  noun: [string, string, string];
  /** активных позиций; null, если склад не прочитался */
  items: number | null;
  /** названия позиций, которые заканчиваются или закончились (по порядку, все) */
  lowNames: string[];
  /** сумма остатков словами валюты; null, если её нет */
  value: string | null;
}

/**
 * «Остатки по складам»: у каждого склада один ответ на вопрос «что докупить». Заголовок карточки — действие
 * (докупить N и какие) или «Всё в порядке»; общие числа мелким шрифтом (ADR-STOCK-ALL, 21.10.2026).
 */
export function WarehouseSummary({ cards }: { cards: WarehouseCard[] }) {
  return (
    <section className="bar-warehouses" aria-label="Остатки по складам">
      {cards.map((card) => {
        const low = card.lowNames.length;
        return (
          <Link key={card.id} href={card.href} prefetch={false} className="panel bar-warehouse" data-warehouse={card.id}>
            <span className="bar-warehouse-head">
              <Icon name={card.id === 'bar' ? 'receipt' : 'stock'} width={20} height={20} />
              <b>{card.title}</b>
              {card.items === null ? (
                <Badge tone="neutral">Нет данных</Badge>
              ) : low > 0 ? (
                <Badge tone="warn">Нужна закупка</Badge>
              ) : (
                <Badge tone="ok">В норме</Badge>
              )}
            </span>
            {card.items === null ? (
              <span className="bar-warehouse-body">Остатки не загрузились</span>
            ) : (
              <>
                <span className="bar-warehouse-title">
                  {low > 0 ? `Докупить: ${pluralRu(low, card.noun, true)}` : 'Всё в порядке'}
                </span>
                {low > 0 && (
                  <span className="bar-warehouse-body">
                    {card.lowNames.slice(0, 3).join(', ')}
                    {low > 3 ? ` и ещё ${low - 3}` : ''}
                  </span>
                )}
                <span className="bar-warehouse-foot">
                  Всего на складе: {pluralRu(card.items, card.noun, true)}
                  {card.value ? ` на ${card.value}` : ''}
                </span>
              </>
            )}
          </Link>
        );
      })}
    </section>
  );
}
