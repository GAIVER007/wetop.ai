'use client';
import Link from 'next/link';
import type { BarSaleRow, BarStockRow } from '../../lib/api';
import { propertyClock } from '../../lib/property-time';
import { ProductAvatar } from './stock-board';
import { useT } from '../../i18n/locale-provider';

/** Only visual grouping of the existing journal and popular-product report. */
export function BarAnalytics({
  sales,
  stock,
  popular,
  timezone,
}: {
  sales: BarSaleRow[];
  stock: BarStockRow[];
  popular: Array<{ name: string; units: string }>;
  timezone: string;
}) {
  const t = useT();
  const clock = propertyClock(timezone);
  const days = new Map<string, number>();
  for (const sale of sales.filter((sale) => sale.status === 'POSTED')) {
    const date = clock.date(sale.createdAt);
    days.set(date, (days.get(date) ?? 0) + 1);
  }
  const series = [...days].sort(([a], [b]) => a.localeCompare(b));
  const max = Math.max(1, ...series.map(([, count]) => count));
  const categories = new Map<string, bigint>();
  for (const product of popular) {
    const category =
      stock.find((item) => item.name === product.name)?.category?.name ?? t('Без категории');
    categories.set(category, (categories.get(category) ?? 0n) + BigInt(product.units));
  }
  const total = [...categories.values()].reduce((sum, units) => sum + units, 0n);
  let offset = 0;
  const parts = [...categories].map(([name, units], index) => {
    const percent = total > 0n ? Number((units * 10000n) / total) / 100 : 0;
    const part = { name, units, percent, offset, index };
    offset += percent;
    return part;
  });
  return (
    <section className="bar-analytics" aria-label={t('Аналитика бара')}>
      <section className="panel bar-chart-panel">
        <header>
          <h2>{t('Продажи по дням')}</h2>
          <span className="bar-muted">{t('По записям журнала')}</span>
        </header>
        {series.length ? (
          <>
            <div
              className="bar-day-chart"
              role="img"
              aria-label={series.map(([day, count]) => t('{day}: {n} продаж', { day, n: count })).join(', ')}
            >
              {series.map(([day, count]) => (
                <div className="bar-day-column" key={day}>
                  <b>{count}</b>
                  <span
                    style={{ // slop-allow: inline-style высота столбца пропорциональна данным журнала
                      height: `${Math.max(3, (count / max) * 100)}%`,
                    }}
                  />
                  <small>
                    {day.slice(8)}.{day.slice(5, 7)}
                  </small>
                </div>
              ))}
            </div>
            <p className="bar-muted">{t('Загруженные продажи, без возвратов')}</p>
          </>
        ) : (
          <p className="bar-chart-empty">{t('Продажи появятся после первой операции')}</p>
        )}
      </section>
      <section className="panel bar-chart-panel">
        <header>
          <h2>{t('Продажи по категориям')}</h2>
        </header>
        {total > 0n ? (
          <>
            <div className="bar-category-chart">
              <svg
                viewBox="0 0 120 120"
                role="img"
                aria-label={t('Распределение популярных товаров по категориям')}
              >
                <circle
                  cx="60"
                  cy="60"
                  r="45"
                  fill="none"
                  stroke="var(--border-soft)"
                  strokeWidth="16"
                />
                {parts.map((part) => (
                  <circle
                    key={part.name}
                    className={`bar-chart-tone-${part.index % 5}`}
                    cx="60"
                    cy="60"
                    r="45"
                    fill="none"
                    strokeWidth="16"
                    pathLength="100"
                    strokeDasharray={`${part.percent} ${100 - part.percent}`}
                    strokeDashoffset={-part.offset}
                    transform="rotate(-90 60 60)"
                  />
                ))}
                <text x="60" y="58" textAnchor="middle">
                  {total.toString()}
                </text>
                <text className="bar-donut-caption" x="60" y="74" textAnchor="middle">
                  {t('шт.')}
                </text>
              </svg>
              <ul>
                {parts.map((part) => (
                  <li key={part.name}>
                    <i className={`bar-chart-tone-${part.index % 5}`} />
                    <span>{part.name}</span>
                    <b>{part.percent}%</b>
                  </li>
                ))}
              </ul>
            </div>
            <p className="bar-muted">{t('По популярным товарам за 30 дней')}</p>
          </>
        ) : (
          <p className="bar-chart-empty">{t('Пока нет данных по категориям')}</p>
        )}
      </section>
      <section className="panel bar-chart-panel bar-top-products">
        <header>
          <h2>{t('Топ товаров')}</h2>
          <Link href="/bar/products" prefetch={false}>
            {t('Все')}
          </Link>
        </header>
        {popular.length ? (
          <ol>
            {popular.map((product) => (
              <li key={product.name}>
                <ProductAvatar name={product.name} />
                <b>{product.name}</b>
                <span>{t('{n} шт.', { n: product.units })}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="bar-chart-empty">{t('Пока нет популярных товаров')}</p>
        )}
        <p className="bar-muted">{t('За последние 30 дней')}</p>
      </section>
    </section>
  );
}
