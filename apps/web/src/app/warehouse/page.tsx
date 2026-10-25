import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { requireFeature } from '../../lib/vertical-guard';
import { stockWords } from '../../lib/stock-words';
import { barApi } from '../../lib/api';
import { stockApi } from '../../lib/food-api';
import { formatMoney } from '../../lib/money';
import { Page } from '../../components/page';
import { Badge, EmptyState, Table } from '../../components/ui';
import { Icon } from '../../components/icon';
import { BarTabs } from '../bar/tabs';
import { stockStatusOf, STATUS_LABEL, STATUS_TONE } from '../bar/stock-status';
import { WarehouseSummary, type WarehouseCard } from '../bar/warehouse-summary';
import { msg } from '../../i18n';
import { serverT } from '../../i18n/server';
import '../bar/bar.css';

const settle = <T,>(promise: Promise<T>) =>
  promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const };
    },
  );

interface LowRow {
  key: string;
  warehouse: string;
  href: string;
  name: string;
  onHand: string;
  minimum: string;
  out: boolean;
}

/**
 * «Обзор склада» (ADR-STOCK-ALL, 21.10.2026): остатки бара и кухни (у салона расходников) рядом и список того, что
 * заканчивается, у всех направлений одинаково. Операции живут на экранах самих складов; сбой чтения одного склада
 * называется словами и не прячет второй.
 */
export default async function WarehousePage() {
  const me = await requireFeature('/warehouse');
  const vertical = me.context?.vertical ?? 'HOSPITALITY';
  const t = await serverT();
  const words = stockWords(vertical);
  // слова склада живут в lib по-русски, переводятся здесь при показе
  const goodsName = t(words.goods);
  const kitchenName = t(words.materials);
  const kitchenHref = vertical === 'FOOD_SERVICE' ? '/stock' : '/bar/consumables';
  const [bar, kitchen] = await Promise.all([settle(barApi.stock()), settle(stockApi.products())]);
  const barItems = bar.ok ? bar.value.filter((item) => item.active) : null;
  const kitchenItems = kitchen.ok ? kitchen.value.items.filter((item) => item.active) : null;
  const currency = barItems?.[0]?.currency ?? 'KZT';
  const barLow = barItems ? barItems.filter((item) => stockStatusOf(item) !== 'ok') : null;
  const kitchenLow = kitchenItems ? kitchenItems.filter((item) => item.low) : null;
  const cards: WarehouseCard[] = [
    {
      id: 'bar',
      title: goodsName,
      href: '/bar',
      noun: [msg('товар'), 'товара', msg('товаров')], // kk-allow: форма склонения
      items: barItems ? barItems.length : null,
      lowNames: (barLow ?? []).map((item) => item.name),
      value: barItems ? formatMoney(barItems.reduce((sum, item) => sum + BigInt(item.stockCostMinor), 0n), currency) : null,
    },
    {
      id: 'kitchen',
      title: kitchenName,
      href: kitchenHref,
      noun: words.materialsNoun,
      items: kitchenItems ? kitchenItems.length : null,
      lowNames: (kitchenLow ?? []).map((item) => item.name),
      value: kitchenItems
        ? formatMoney(kitchenItems.reduce((sum, item) => sum + BigInt(item.valueMinor), 0n), currency)
        : null,
    },
  ];
  const low: LowRow[] = [
    ...(barItems ?? [])
      .filter((item) => stockStatusOf(item) !== 'ok')
      .map((item) => ({
        key: `bar-${item.id}`,
        warehouse: goodsName,
        href: `/bar?product=${item.id}`,
        name: item.name,
        onHand: t('{n} шт.', { n: item.availableUnits }),
        minimum: t('{n} шт.', { n: item.minimumStockUnits }),
        out: stockStatusOf(item) === 'out',
      })),
    ...(kitchenItems ?? [])
      .filter((item) => item.low)
      .map((item) => ({
        key: `kitchen-${item.id}`,
        warehouse: kitchenName,
        href: kitchenHref,
        name: item.name,
        onHand: `${item.onHand} ${item.unit}`,
        minimum: `${item.minQty} ${item.unit}`,
        out: Number(item.onHand) <= 0,
      })),
  ];
  return (
    <Page width="wide" className="bar-subpage" title={t('Склад')} subtitle={t(words.overviewSubtitle)}>
      <BarTabs current="warehouse" />
      <WarehouseSummary cards={cards} />
      <section className="panel bar-low" aria-labelledby="warehouse-low-title">
        <h2 id="warehouse-low-title" className="bar-panel-title">
          {t('Что заканчивается')}
        </h2>
        {bar.ok && kitchen.ok && low.length === 0 ? (
          <EmptyState icon={<Icon name="stock" />} title={t('Всё в норме')}>
            {t(words.overviewOk)}
          </EmptyState>
        ) : (
          <Table density="compact" aria-label={t('Позиции, которые заканчиваются')} plain>
            <thead>
              <tr>
                <th>{t('Склад')}</th>
                <th>{t('Позиция')}</th>
                <th>{t('Остаток')}</th>
                <th>{t('Минимум')}</th>
                <th>{t('Статус')}</th>
              </tr>
            </thead>
            <tbody>
              {low.map((row) => (
                <tr key={row.key}>
                  <td>{row.warehouse}</td>
                  <td>
                    <Link href={row.href} prefetch={false} className="bar-link">
                      {row.name}
                    </Link>
                  </td>
                  <td>{row.onHand}</td>
                  <td>{row.minimum}</td>
                  <td>
                    <Badge tone={STATUS_TONE[row.out ? 'out' : 'low']}>{t(STATUS_LABEL[row.out ? 'out' : 'low'])}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {(!bar.ok || !kitchen.ok) && (
          <p className="bar-muted">
            {!bar.ok ? `${t('Остатки склада «{name}» не загрузились.', { name: goodsName })} ` : ''}
            {!kitchen.ok ? t('Остатки склада «{name}» не загрузились.', { name: kitchenName }) : ''}
          </p>
        )}
      </section>
    </Page>
  );
}
