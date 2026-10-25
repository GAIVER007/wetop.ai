'use client';
import Link from 'next/link';
import { Badge, Table } from '../../components/ui';
import { formatMoney } from '../../lib/money';
import { pluralRu } from '../../lib/plural';
import { countLabel, msg } from '../../i18n';
import { useLocale, useT } from '../../i18n/locale-provider';
import { FOOD_COST_LIMIT_PCT, type StockInsights } from './stock-insights-data';

const PORTION_FORMS: [string, string, string] = [msg('порция'), 'порции', msg('порций')]; // kk-allow: форма склонения
const EXPENSIVE_FORMS: [string, string, string] = [msg('Блюдо невыгодно'), msg('Блюда невыгодны'), msg('Блюда невыгодны')];

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
  const t = useT();
  const locale = useLocale();
  const { restock, expensive, dishes } = insights;
  const money = (minor: string) => formatMoney(minor, currency);
  return (
    <section className="stock-insights" aria-label={t('Что докупить и блюда')}>
      {restock.length > 0 && (
        <div role="status" className="alert alert--warning alert--boxed" data-testid="stock-restock">
          <b>{t('Докупить:')}</b>{' '}
          {restock.slice(0, 5).map((p, i) => (
            <span key={p.id}>
              {i > 0 && ', '}
              {p.name} {t('({qty} {unit} при минимуме {min} {unit})', { qty: p.onHand, unit: p.unit, min: p.minQty })}
            </span>
          ))}
          {restock.length > 5 && t(' и ещё {n}', { n: restock.length - 5 })}.
          {dishes.some((d) => d.portions !== null && d.portions <= 10 && d.limiting && restock.some((p) => p.name === d.limiting)) &&
            t(' Из-за этого скоро нельзя будет продать часть блюд.')}
        </div>
      )}
      {expensive.length > 0 && (
        <div role="status" className="alert alert--boxed" data-testid="stock-expensive">
          <b>
            {t(locale === 'ru' ? pluralRu(expensive.length, EXPENSIVE_FORMS, false) : expensive.length === 1 ? EXPENSIVE_FORMS[0] : EXPENSIVE_FORMS[2])}:
          </b>{' '}
          {expensive.map((d, i) => (
            <span key={d.id}>
              {i > 0 && ', '}
              {d.name} {t('(продукты {pct}% цены)', { pct: d.foodCostPct ?? 0 })}
            </span>
          ))}
          {t('. Норма до {limit}%: поднимите цену или пересмотрите состав.', { limit: FOOD_COST_LIMIT_PCT })}
        </div>
      )}
      {dishes.length > 0 && (
        <section className="panel" aria-labelledby="stock-dishes-title">
          <header className="stock-insights__head">
            <h2 id="stock-dishes-title">{t('Блюда и порции из остатков')}</h2>
            {menuHref && (
              <Link href={menuHref} prefetch={false} className="btn btn--secondary">
                {t('Меню и техкарты')}
              </Link>
            )}
          </header>
          <Table density="compact" aria-label={t('Блюда: себестоимость и порции из остатков')} plain>
            <thead>
              <tr>
                <th>{t('Блюдо')}</th>
                <th title={t('Сколько стоят продукты на одну порцию')}>{t('Продукты на порцию')}</th>
                <th>{t('Цена в меню')}</th>
                <th title={t('Доля продуктов в цене блюда')}>{t('Доля продуктов')}</th>
                <th title={t('Сколько целых порций хватит из остатков склада')}>{t('Порций из остатков')}</th>
                <th>{t('Ограничивает')}</th>
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
                      t('Не связано со складом')
                    ) : (
                      <Badge tone={d.portions === 0 ? 'danger' : d.portions <= 10 ? 'warn' : 'ok'}>
                        {countLabel(locale, t, d.portions, PORTION_FORMS)}
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
