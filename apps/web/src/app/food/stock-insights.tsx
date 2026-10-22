import Link from 'next/link';
import { Badge, Table } from '../../components/ui';
import { formatMoney } from '../../lib/money';
import { pluralRu } from '../../lib/plural';
import { FOOD_COST_LIMIT_PCT, type StockInsights } from './stock-insights-data';

/**
 * Над остатками кухни: что докупить и, у ресторана, какие блюда страдают и сколько порций хватит (ADR-STOCK-ALL).
 * Все числа готовит `buildStockInsights`; блюда правятся на экране «Меню», отсюда ссылка туда.
 */
export function StockInsightsView({
  insights,
  currency,
  menuHref,
}: {
  insights: StockInsights;
  currency: string;
  /** у ресторана экран меню с техкартами; у гостиницы и салона блюд нет */
  menuHref?: string;
}) {
  const { restock, expensive, dishes } = insights;
  const money = (minor: string) => formatMoney(minor, currency);
  return (
    <section className="stock-insights" aria-label="Что докупить и блюда">
      {restock.length > 0 && (
        <div role="status" className="alert alert--warning alert--boxed" data-testid="stock-restock">
          <b>Докупить:</b>{' '}
          {restock.slice(0, 5).map((p, i) => (
            <span key={p.id}>
              {i > 0 && ', '}
              {p.name} ({p.onHand} {p.unit} при минимуме {p.minQty} {p.unit})
            </span>
          ))}
          {restock.length > 5 && ` и ещё ${restock.length - 5}`}.
          {dishes.some((d) => d.portions !== null && d.portions <= 10 && d.limiting && restock.some((p) => p.name === d.limiting)) &&
            ' Из-за этого скоро нельзя будет продать часть блюд.'}
        </div>
      )}
      {expensive.length > 0 && (
        <div role="status" className="alert alert--boxed" data-testid="stock-expensive">
          <b>{pluralRu(expensive.length, ['Блюдо невыгодно', 'Блюда невыгодны', 'Блюда невыгодны'], false)}:</b>{' '}
          {expensive.map((d, i) => (
            <span key={d.id}>
              {i > 0 && ', '}
              {d.name} (продукты {d.foodCostPct}% цены)
            </span>
          ))}
          . Норма до {FOOD_COST_LIMIT_PCT}%: поднимите цену или пересмотрите состав.
        </div>
      )}
      {dishes.length > 0 && (
        <section className="panel" aria-labelledby="stock-dishes-title">
          <header className="stock-insights__head">
            <h2 id="stock-dishes-title">Блюда и порции из остатков</h2>
            {menuHref && (
              <Link href={menuHref} prefetch={false} className="btn btn--secondary">
                Меню и техкарты
              </Link>
            )}
          </header>
          <Table density="compact" aria-label="Блюда: себестоимость и порции из остатков" plain>
            <thead>
              <tr>
                <th>Блюдо</th>
                <th title="Сколько стоят продукты на одну порцию">Продукты на порцию</th>
                <th>Цена в меню</th>
                <th title="Доля продуктов в цене блюда">Доля продуктов</th>
                <th title="Сколько целых порций хватит из остатков склада">Порций из остатков</th>
                <th>Ограничивает</th>
              </tr>
            </thead>
            <tbody>
              {dishes.map((d) => (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td>{money(d.costMinor)}</td>
                  <td>{money(d.priceMinor)}</td>
                  <td>
                    {d.foodCostPct === null ? (
                      '—'
                    ) : (
                      <Badge tone={d.foodCostPct > FOOD_COST_LIMIT_PCT ? 'warn' : 'ok'}>{`${d.foodCostPct}%`}</Badge>
                    )}
                  </td>
                  <td>
                    {d.portions === null ? (
                      'Не связано со складом'
                    ) : (
                      <Badge tone={d.portions === 0 ? 'danger' : d.portions <= 10 ? 'warn' : 'ok'}>
                        {pluralRu(d.portions, ['порция', 'порции', 'порций'], true)}
                      </Badge>
                    )}
                  </td>
                  <td className="muted">{d.portions !== null && d.portions <= 10 ? d.limiting : ''}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>
      )}
    </section>
  );
}
