'use client';
import Link from 'next/link';
import { Badge } from '../../components/ui';
import { Icon } from '../../components/icon';
import { pluralRu } from '../../lib/plural';
import { useLocale, useT } from '../../i18n/locale-provider';

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
  const t = useT();
  const locale = useLocale();
  // у казахского существительное после числа не меняется: «5 тауар»
  const counted = (n: number, noun: WarehouseCard['noun']) => (locale === 'kk' ? `${n} ${t(noun[0])}` : pluralRu(n, noun, true));
  return (
    <section className="bar-warehouses" aria-label={t('Остатки по складам')}>
      {cards.map((card) => {
        const low = card.lowNames.length;
        return (
          <Link key={card.id} href={card.href} prefetch={false} className="panel bar-warehouse" data-warehouse={card.id}>
            <span className="bar-warehouse-head">
              <Icon name={card.id === 'bar' ? 'receipt' : 'stock'} width={20} height={20} />
              <b>{card.title}</b>
              {card.items === null ? (
                <Badge tone="neutral">{t('Нет данных')}</Badge>
              ) : card.items === 0 ? (
                <Badge tone="neutral">{t('Пусто')}</Badge>
              ) : low > 0 ? (
                <Badge tone="warn">{t('Нужна закупка')}</Badge>
              ) : (
                <Badge tone="ok">{t('В норме')}</Badge>
              )}
            </span>
            {card.items === null ? (
              <span className="bar-warehouse-body">{t('Остатки не загрузились')}</span>
            ) : (
              <>
                <span className="bar-warehouse-title">
                  {card.items === 0
                    ? t('Пока пусто')
                    : low > 0
                      ? t('Докупить: {count}', { count: counted(low, card.noun) })
                      : t('Всё в порядке')}
                </span>
                {low > 0 && (
                  <span className="bar-warehouse-body">
                    {card.lowNames.slice(0, 3).join(', ')}
                    {low > 3 ? ` ${t('и ещё {n}', { n: low - 3 })}` : ''}
                  </span>
                )}
                <span className="bar-warehouse-foot">
                  {card.items === 0
                    ? t('Позиций на складе нет: добавьте первую или оформите приход')
                    : card.value
                      ? t('Всего на складе: {count} на {value}', { count: counted(card.items, card.noun), value: card.value })
                      : t('Всего на складе: {count}', { count: counted(card.items, card.noun) })}
                </span>
              </>
            )}
          </Link>
        );
      })}
    </section>
  );
}
