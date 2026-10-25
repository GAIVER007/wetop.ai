'use client';
import type { MenuCostingReport } from '../../lib/food-types';
import { formatMoney } from '../../lib/money';
import { Badge, Table } from '../../components/ui';
import { msg } from '../../i18n';
import { useT } from '../../i18n/locale-provider';

/** Доля продуктов в цене: до 30% хорошо, до 40% внимание, выше дорого (ориентир общепита) */
export function foodCostTone(pct: number | null): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (pct === null) return 'neutral';
  return pct <= 30 ? 'ok' : pct <= 40 ? 'warn' : 'danger';
}

const SOURCE = { STOCK: msg('по складу'), CARD: msg('по техкарте'), NONE: msg('нет цены') } as const;

/**
 * «Себестоимость и маржа» меню (DATA_MODEL §62.4, K4): по каждой позиции цена, себестоимость продуктов по текущему
 * складу кухни (иначе по техкарте), прибыль и доля продуктов; раскрытие показывает строки техкарты и добавки.
 * Общий блок ресторана (`/menu`) и «Меню бара» гостиницы и салона (`/bar/menu`). Только чтение.
 */
export function MenuCostingPanel({ report }: { report: MenuCostingReport }) {
  const t = useT();
  const money = (minor: string) => formatMoney(minor, report.currency);
  const items = report.items.filter((i) => i.active);
  const missing = items.filter((i) => i.missing.length > 0).length;
  return (
    <section className="panel food-costing" aria-labelledby="food-costing-title" data-testid="menu-costing">
      <header className="food-costing-head">
        <h2 id="food-costing-title">{t('Себестоимость и маржа')}</h2>
        <p className="food-muted">
          {t('Продукты по текущим ценам склада кухни, без склада по цене из техкарты.')}
          {missing > 0 && t(' Без цены продукта: {n} поз.', { n: missing })}
        </p>
      </header>
      {items.length === 0 ? (
        <p className="food-muted">{t('Позиций в меню пока нет.')}</p>
      ) : (
        <Table density="compact" aria-label={t('Себестоимость и маржа позиций меню')} plain>
          <thead>
            <tr>
              <th scope="col">{t('Позиция')}</th>
              <th scope="col">{t('Цена')}</th>
              <th scope="col">{t('Себестоимость')}</th>
              <th scope="col">{t('Прибыль')}</th>
              <th scope="col">{t('Доля продуктов')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} data-testid="menu-costing-row">
                <td>
                  <details className="food-costing-details">
                    <summary>
                      {i.name} <span className="food-muted">{i.categoryName}</span>
                    </summary>
                    {i.lines.length === 0 ? (
                      <p className="food-muted">{t('Техкарты нет: себестоимость не посчитана.')}</p>
                    ) : (
                      <ul className="food-costing-lines">
                        {i.lines.map((l, n) => (
                          <li key={`${l.name}-${n}`}>
                            {l.name}, {l.normQty} {l.unit}: {l.source === 'NONE' ? t('нет цены') : money(l.costMinor)}{' '}
                            <span className="food-muted">{t(SOURCE[l.source])}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {i.modifiers.length > 0 && (
                      <ul className="food-costing-lines" aria-label={t('Добавки: {name}', { name: i.name })}>
                        {i.modifiers.map((m) => (
                          <li key={m.id}>
                            {t('Добавка «{name}»: цена +{price}, продукты {cost}, прибыль {profit}', {
                              name: m.name,
                              price: money(m.priceDeltaMinor),
                              cost: money(m.costMinor),
                              profit: money(m.profitMinor),
                            })}
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                </td>
                <td>{money(i.priceMinor)}</td>
                <td>
                  {money(i.costMinor)}
                  {i.missing.length > 0 && (
                    <>
                      {' '}
                      <Badge tone="warn" title={t('Нет цены: {list}', { list: i.missing.join(', ') })}>
                        {t('нет цены: {n}', { n: i.missing.length })}
                      </Badge>
                    </>
                  )}
                </td>
                <td>{money(i.profitMinor)}</td>
                <td>
                  {i.foodCostPct === null ? (
                    '—'
                  ) : (
                    <Badge tone={foodCostTone(i.foodCostPct)}>{i.foodCostPct}%</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </section>
  );
}
