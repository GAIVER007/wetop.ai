import Link from 'next/link';
import { requireVertical } from '../../lib/vertical-guard';
import { unstable_rethrow } from 'next/navigation';
import { barApi, type BarReceiptRow, type BarReport, type BarSaleRow } from '../../lib/api';
import { hotelToday, propertyTimezone } from '../../lib/hotel-api';
import { formatMoney } from '../../lib/money';
import { pluralRu } from '../../lib/plural';
import { Page } from '../../components/page';
import { Tabs } from '../../components/tabs';
import { ActionMenu } from '../../components/action-menu';
import { Badge, EmptyState, Table, cx } from '../../components/ui';
import { Icon, type IconName } from '../../components/icon';
import { SaleForm } from './sale-form';
import { FolioSaleForm } from './folio-sale-form';
import { StockBoard } from './stock-board';
import { sharePercent, stockStatusOf } from './stock-status';
import { AnalyticsDisclosure } from './analytics-disclosure';
import { SaleDisclosure } from './sale-disclosure';
import { BarAnalytics } from './bar-analytics';
import './bar.css';

const settle = <T,>(promise: Promise<T>) =>
  promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const, error };
    },
  );

const receiptBadge = (receipt: BarReceiptRow) => {
  if (receipt.status === 'DRAFT') return { tone: 'neutral' as const, label: 'Черновик' };
  if (BigInt(receipt.dueAmount) <= 0n) return { tone: 'ok' as const, label: 'Оплачен' };
  return BigInt(receipt.paidAmount) > 0n
    ? { tone: 'warn' as const, label: 'Оплачен частично' }
    : { tone: 'danger' as const, label: 'Не оплачен' };
};
const dayRu = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}`;

/** Популярные за 30 дней: из отчёта API; старый API без поля, тогда из последних продаж */
function popularOf(report: BarReport, sales: BarSaleRow[]): Array<{ name: string; units: string }> {
  if (report.popular) return report.popular;
  const byName = new Map<string, bigint>();
  for (const sale of sales) {
    if (sale.status !== 'POSTED') continue;
    for (const line of sale.lines)
      byName.set(
        line.product.name,
        (byName.get(line.product.name) ?? 0n) + BigInt(line.quantityUnits),
      );
  }
  return [...byName.entries()]
    .sort((a, b) => (a[1] === b[1] ? a[0].localeCompare(b[0], 'ru') : a[1] > b[1] ? -1 : 1))
    .slice(0, 5)
    .map(([name, units]) => ({ name, units: units.toString() }));
}

/** Плитка показателя по макету: цветная иконка слева, подпись, число, подсказка или прирост к прошлому месяцу */
function Kpi({
  icon,
  tone,
  label,
  value,
  hint,
  growth,
  alarm,
  unavailable,
}: {
  icon: IconName;
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  label: string;
  value: string;
  hint?: string;
  growth?: number | null;
  alarm?: boolean;
  unavailable?: boolean;
}) {
  return (
    <div
      className={cx('bar-kpi', alarm && 'bar-kpi--alarm', unavailable && 'bar-kpi--unavailable')}
    >
      <span className={`bar-kpi-icon bar-kpi-icon--${tone}`}>
        <Icon name={icon} width={24} height={24} />
      </span>
      <div className="bar-kpi-body">
        <div className="bar-kpi-label" title={label}>
          {label}
        </div>
        <div className="bar-kpi-value">{value}</div>
      </div>
      {growth !== undefined && growth !== null ? (
        <div
          className={cx(
            'bar-kpi-hint',
            'bar-kpi-hint--wide',
            growth >= 0 ? 'bar-kpi-hint--up' : 'bar-kpi-hint--down',
          )}
        >
          <span className="bar-kpi-delta">
            <Icon name={growth >= 0 ? 'up' : 'downArrow'} width={14} height={14} />{' '}
            {growth >= 0 ? '+' : '−'}
            {Math.abs(growth)}%
          </span>{' '}
          к прошлому месяцу
        </div>
      ) : (
        hint && <div className="bar-kpi-hint">{hint}</div>
      )}
    </div>
  );
}

/**
 * Обзор бара по макету владельца (09.10.2026, ADR-157): плитки, «Быстрая продажа» и «Добавить в счёт гостя»,
 * «Товары и остатки» с карточкой товара справа, приходы поставщиков и популярные товары. Журналы целиком и
 * справочники живут на вкладках раздела, вход в них из меню «…».
 */
export default async function BarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireVertical(['HOSPITALITY']);
  const params = await searchParams;
  const productParam = typeof params.product === 'string' ? params.product : null;
  const [categories, stock, suppliers, folios, receipts, sales, movements, report, today] =
    await Promise.all([
      settle(barApi.categories()),
      settle(barApi.stock()),
      settle(barApi.suppliers()),
      settle(barApi.folios()),
      settle(barApi.receipts()),
      settle(barApi.sales()),
      settle(barApi.movements()),
      settle(barApi.report()),
      hotelToday(),
    ]);
  const failed = [categories, stock, suppliers, folios, receipts, sales, movements, report].find(
    (result) => !result.ok,
  );
  if (failed && !failed.ok) throw failed.error;
  if (
    !categories.ok ||
    !stock.ok ||
    !suppliers.ok ||
    !folios.ok ||
    !receipts.ok ||
    !sales.ok ||
    !movements.ok ||
    !report.ok
  )
    return null;
  const r = report.value;
  const active = stock.value.filter((item) => item.active);
  const unitsTotal = active.reduce((sum, item) => sum + BigInt(item.availableUnits), 0n);
  const lowCount = active.filter((item) => stockStatusOf(item) !== 'ok').length;
  const timezone = await propertyTimezone();
  const monthRevenue = BigInt(r.month?.revenueMinor ?? r.revenueMinor);
  const monthProfit = BigInt(r.month?.grossProfitMinor ?? r.grossProfitMinor);
  const margin = sharePercent(monthProfit, monthRevenue);
  const lastReceipts = receipts.value.slice(0, 4);
  const popular = popularOf(r, sales.value);
  const bottom = (
    <div className="bar-bottom">
      <section className="panel bar-bottom-panel" aria-labelledby="bar-receipts-title">
        <header className="bar-bottom-head">
          <h2 id="bar-receipts-title" className="bar-panel-title">
            Приходы от поставщиков
          </h2>
          <Link href="/bar/receipts" prefetch={false} className="bar-link">
            Все приходы <Icon name="arrow" width={16} height={16} />
          </Link>
        </header>
        {lastReceipts.length === 0 ? (
          <p className="bar-muted">
            Приходов пока нет: занесите первую счёт-фактуру кнопкой «Приход».
          </p>
        ) : (
          <Table density="compact" aria-label="Последние приходы поставщиков" plain>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Поставщик</th>
                <th>№ документа</th>
                <th>Товаров</th>
                <th>Сумма</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {lastReceipts.map((receipt) => {
                const badge = receiptBadge(receipt);
                return (
                  <tr key={receipt.id}>
                    <td>{dayRu(receipt.receivedDate.slice(0, 10))}</td>
                    <td>{receipt.supplier.name}</td>
                    <td>{receipt.documentNumber}</td>
                    <td>{receipt._count.lines}</td>
                    <td>{formatMoney(receipt.totalAmount)}</td>
                    <td>
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </section>
      <section className="panel bar-bottom-panel" aria-labelledby="bar-popular-title">
        <header className="bar-bottom-head bar-bottom-head--stack">
          <h2 id="bar-popular-title" className="bar-panel-title">
            Популярные товары
          </h2>
          <span className="bar-muted">За последний месяц</span>
        </header>
        {popular.length === 0 ? (
          <p className="bar-muted">Продаж за месяц нет: первая продажа заполнит список.</p>
        ) : (
          <ol className="bar-popular">
            {popular.map((item, index) => (
              <li key={item.name}>
                <span className="bar-popular-rank">{index + 1}</span>
                <span className="bar-popular-name">{item.name}</span>
                <b>{item.units} шт.</b>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
  return (
    <Page
      width="full"
      className="bar-page"
      title="Бар"
      subtitle="Товары, остатки и продажи"
      actions={
        <>
          <Link className="btn" href="/bar/receipts/new" prefetch={false}>
            <Icon name="plus" width={16} height={16} /> Приход
          </Link>
          <a className="btn btn--secondary" href="#bar-quick-sale">
            <Icon name="plus" width={16} height={16} /> Продажа
          </a>
          <Link
            className="btn btn--secondary"
            href="/bar/operations#bar-inventory"
            prefetch={false}
          >
            <Icon name="plus" width={16} height={16} /> Инвентаризация
          </Link>
          <span className="bar-period-label">
            <Icon name="board" width={16} height={16} />
            {r.month
              ? new Intl.DateTimeFormat('ru-RU', {
                  month: 'long',
                  year: 'numeric',
                  timeZone: 'UTC',
                }).format(new Date(`${r.month.monthStart}T12:00:00Z`))
              : 'Текущий месяц'}
          </span>
          <ActionMenu
            label="Ещё разделы бара"
            items={[
              { label: 'Добавить товар', href: '/bar?product=new' },
              { label: 'Все товары и категории', href: '/bar/products' },
              { label: 'Все приходы', href: '/bar/receipts' },
              { label: 'Поставщики', href: '/bar/suppliers' },
              { label: 'Списания и инвентаризация', href: '/bar/operations' },
            ]}
          />
        </>
      }
    >
      <nav className="bar-mobile-actions" aria-label="Быстрые действия бара">
        <Link href="/bar/receipts/new" className="btn btn--secondary" prefetch={false}>
          Приход
        </Link>
        <a href="#bar-quick-sale" className="btn">
          Продажа
        </a>
        <Link
          href="/bar/operations#bar-inventory"
          className="btn btn--secondary"
          prefetch={false}
          aria-label="Инвентаризация"
        >
          Пересчёт
        </Link>
        <ActionMenu
          label="Разделы бара"
          items={[
            { label: 'Товары и категории', href: '/bar/products' },
            { label: 'Приходы', href: '/bar/receipts' },
            { label: 'Поставщики', href: '/bar/suppliers' },
            { label: 'Операции', href: '/bar/operations' },
          ]}
        />
      </nav>
      <section className="bar-kpis" aria-label="Показатели бара">
        <Kpi
          icon="chart"
          tone="primary"
          label="Выручка"
          value={formatMoney(monthRevenue)}
          growth={r.month?.revenueGrowth ?? null}
          hint="за текущий месяц"
        />
        <Kpi
          icon="receipt"
          tone="primary"
          label="Продаж"
          value="Нет данных"
          unavailable
          hint="за текущий месяц"
        />
        <Kpi
          icon="cart"
          tone="info"
          label="Средний чек"
          value="Нет данных"
          unavailable
          hint="за текущий месяц"
        />
        <Kpi
          icon="coins"
          tone="success"
          label="Валовая прибыль"
          value={formatMoney(monthProfit)}
          hint={margin === null ? 'продаж за месяц нет' : `маржинальность ${margin}%`}
        />
        <Kpi
          icon="stock"
          tone="primary"
          label="Остаток на складе"
          value={`${unitsTotal} шт.`}
          hint={`на сумму ${formatMoney(r.stockCostMinor)}`}
        />
        <Kpi
          icon="incidents"
          tone="danger"
          label="Заканчиваются"
          value={String(lowCount)}
          hint={pluralRu(lowCount, ['товар', 'товара', 'товаров'], false)}
          alarm={lowCount > 0}
        />
      </section>
      <AnalyticsDisclosure>
        <BarAnalytics
          sales={sales.value}
          stock={stock.value}
          popular={popular}
          timezone={timezone}
        />
      </AnalyticsDisclosure>
      <SaleDisclosure>
        <section className="panel bar-sales" aria-label="Продажи бара">
          <Tabs
            label="Способ продажи"
            panels={[
              {
                id: 'bar-retail',
                label: 'Продажа напрямую',
                content: <SaleForm stock={stock.value} />,
              },
              {
                id: 'bar-folio',
                label: 'В счёт гостя',
                content:
                  folios.value.length === 0 ? (
                    <p className="bar-muted">Открытых счетов нет. Доступна продажа напрямую.</p>
                  ) : (
                    <FolioSaleForm stock={stock.value} folios={folios.value} />
                  ),
              },
            ]}
          />
        </section>
      </SaleDisclosure>
      {stock.value.length === 0 ? (
        <>
          <EmptyState icon={<Icon name="product" />} title="Товаров пока нет">
            Добавьте первый товар кнопкой «Добавить товар» или загрузите фото накладной: «Приход».
          </EmptyState>
          {bottom}
        </>
      ) : (
        <StockBoard
          key={productParam ?? 'first'}
          stock={stock.value}
          categories={categories.value}
          suppliers={suppliers.value}
          movements={movements.value}
          today={today}
          initialProduct={productParam ?? null}
          bottom={
            <details className="bar-details">
              <summary>Приходы и популярные товары</summary>
              {bottom}
            </details>
          }
        />
      )}
    </Page>
  );
}
