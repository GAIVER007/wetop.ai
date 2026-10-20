import Link from 'next/link';
import { requireFeature } from '../../lib/vertical-guard';
import { unstable_rethrow } from 'next/navigation';
import { barApi, type BarReceiptRow, type BarReport, type BarSaleRow } from '../../lib/api';
import { hotelToday, propertyTimezone } from '../../lib/hotel-api';
import { formatMoney } from '../../lib/money';
import { pluralRu } from '../../lib/plural';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { Tabs } from '../../components/tabs';
import { BarTabs } from './tabs';
import { loadBarContext } from './load-context';
import { Badge, EmptyState, Table, cx } from '../../components/ui';
import { Icon, type IconName } from '../../components/icon';
import { SaleForm } from './sale-form';
import { FolioSaleForm } from './folio-sale-form';
import { StockBoard } from './stock-board';
import { stockStatusOf } from './stock-status';
import { AnalyticsDisclosure } from './analytics-disclosure';
import { SaleDisclosure } from './sale-disclosure';
import { BarAnalytics } from './bar-analytics';
import { deskShell } from '../../lib/desk-shell';
import { barActionAccess } from './action-access';
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
function Kpi({icon, tone, label, value, hint, alarm, children}: {
  icon: IconName; tone: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  label: string; value: string; hint: string; alarm?: boolean; children?: import('react').ReactNode;
}) {
  return <div className={cx('bar-kpi',alarm && 'bar-kpi--alarm')}>
    <span className={`bar-kpi-icon bar-kpi-icon--${tone}`}><Icon name={icon} width={24} height={24} /></span>
    <div className="bar-kpi-body"><div className="bar-kpi-label">{label}</div><div className="bar-kpi-value">{value}</div></div>
    <div className="bar-kpi-hint">{hint}</div>
    {children}
  </div>;
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
  const me = await requireFeature('/bar');
  // бар филиала (ADR-178): «в счёт гостя» только у гостиницы; ресторан и салон продают в кассу филиала (§45, §48)
  const vertical = me.context?.vertical ?? 'HOSPITALITY';
  // раздел меню «Склад» у всех направлений (решение владельца 19.10.2026)
  const sectionName = 'Склад';
  const params = await searchParams;
  const productParam = typeof params.product === 'string' ? params.product : null;
  const [categories, stock, suppliers, folios, receipts, sales, movements, report, paymentMethods, today, shell] =
    await Promise.all([
      settle(barApi.categories()),
      settle(barApi.stock()),
      settle(barApi.suppliers()),
      vertical === 'HOSPITALITY'
        ? settle(barApi.folios())
        : Promise.resolve({ ok: true as const, value: [] }),
      settle(barApi.receipts()),
      settle(barApi.sales()),
      settle(barApi.movements()),
      settle(barApi.report()),
      settle(barApi.paymentMethods()),
      hotelToday(),
      deskShell(),
    ]);
  // UI-FIX-01: продажа, приход и остаток пишут по праву desk, каталог по праву settings; в режиме чтения команд нет.
  const rights = barActionAccess(shell, vertical);
  const canSell = rights.sell;
  const canCatalogMutate = rights.updateCatalog || rights.archiveCatalog;
  const failed = [categories, stock, suppliers, folios, receipts, sales, movements, report, paymentMethods].find(
    (result) => !result.ok,
  );
  // Отказ чтения называется словами сервера (например, смешанная валюта истории, D-CUR), а не общим экраном ошибки
  // и не нулями в плитках
  if (failed && !failed.ok) {
    const error = loadErrorProps(failed.error);
    // 409 это деловой отказ сервера (смешанная валюта истории, D-CUR): его слова и есть заголовок
    return (
      <Page width="full" className="bar-page" title={sectionName}>
        <LoadError
          testId="bar-load-error"
          {...error}
          {...(error.status === 409 && failed.error instanceof Error ? { title: failed.error.message } : {})}
        />
      </Page>
    );
  }
  if (
    !categories.ok ||
    !stock.ok ||
    !suppliers.ok ||
    !folios.ok ||
    !receipts.ok ||
    !sales.ok ||
    !movements.ok ||
    !report.ok ||
    !paymentMethods.ok
  )
    return null;
  // контекст форм: объект и валюта, сервер сверяет их при каждой денежной команде (D-CUR); у салона вместо объекта филиал
  const context = await loadBarContext();
  const r = report.value;
  // суммы в валюте объекта (D-CUR): без валюты formatMoney подписывает тенге и для объекта в USD
  const money = (minor: string | bigint) => formatMoney(minor, r.currency);
  const active = stock.value.filter((item) => item.active);
  const lowStock = active.filter((item) => stockStatusOf(item) !== 'ok');
  const lowCount = lowStock.length;
  const timezone = await propertyTimezone();
  const monthRevenue = BigInt(r.month?.revenueMinor ?? r.revenueMinor);
  const monthProfit = BigInt(r.month?.grossProfitMinor ?? r.grossProfitMinor);
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
                    <td>{money(receipt.totalAmount)}</td>
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
      title={sectionName}
      subtitle="Товары, остатки и продажи"
      actions={
        <>
          {rights.receiveStock && (
              <Link className="btn" href="/bar/receipts/new" prefetch={false}>
                <Icon name="plus" width={16} height={16} /> Приход
              </Link>
          )}
          {canSell && (
              <a className="btn btn--secondary" href="#bar-quick-sale">
                <Icon name="plus" width={16} height={16} /> Продажа
              </a>
          )}
          {rights.operateStock && (
              <Link
                className="btn btn--secondary"
                href="/bar/operations#bar-inventory"
                prefetch={false}
              >
                <Icon name="plus" width={16} height={16} /> Инвентаризация
              </Link>
          )}
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
        </>
      }
    >
      <nav className="bar-mobile-actions" aria-label={`Быстрые действия ${vertical === 'BEAUTY' ? 'склада' : 'бара'}`}>
        {rights.receiveStock && <Link href="/bar/receipts/new" className="btn btn--secondary" prefetch={false}>
          Приход
        </Link>}
        {canSell && <a href="#bar-quick-sale" className="btn">
          Продажа
        </a>}
        {rights.operateStock && <Link
          href="/bar/operations#bar-inventory"
          className="btn btn--secondary"
          prefetch={false}
          aria-label="Инвентаризация"
        >
          Пересчёт
        </Link>}
      </nav>
      <BarTabs current="overview" />
      <section className="bar-kpis" aria-label={`Показатели ${vertical === 'BEAUTY' ? 'склада' : 'бара'}`}>
        <Kpi icon="cart" tone="info" label="Сумма закупок" value={money(r.month?.purchasesMinor ?? r.purchasesMinor)} hint={r.month ? 'За текущий месяц' : 'За всё время'} />
        <Kpi icon="chart" tone="primary" label={vertical === 'BEAUTY' ? 'Выручка склада' : 'Выручка бара'} value={money(monthRevenue)} hint={r.month ? 'За текущий месяц' : 'За всё время'} />
        <Kpi icon="coins" tone="success" label="Прибыль от продаж" value={money(monthProfit)} hint={r.month ? 'Текущий месяц, без прочих расходов' : 'За всё время, без прочих расходов'} />
        <Kpi icon="truck" tone="warning" label="Долг поставщикам" value={money(r.supplierDebtMinor)} hint="Осталось оплатить" />
        <Kpi icon="incidents" tone="danger" label="Заканчиваются" value={String(lowCount)} hint={lowCount ? pluralRu(lowCount,['товар','товара','товаров'],false) : 'Нет предупреждений'} alarm={lowCount > 0}>
          {lowCount > 0 && <details className="bar-kpi-list"><summary>Список товаров</summary><ul>{lowStock.map(item => <li key={item.id}><Link href={`/bar?product=${item.id}`} prefetch={false}>{item.name}</Link><b>{item.availableUnits} шт.</b></li>)}</ul></details>}
        </Kpi>
      </section>
      <AnalyticsDisclosure>
        <BarAnalytics
          sales={sales.value}
          stock={stock.value}
          popular={popular}
          timezone={timezone}
        />
      </AnalyticsDisclosure>
      {canSell && (
      <SaleDisclosure label={vertical === 'HOSPITALITY' ? undefined : 'Продажа напрямую'}>
        <section className="panel bar-sales" aria-label={`Продажи ${vertical === 'BEAUTY' ? 'склада' : 'бара'}`}>
          <Tabs
            label="Способ продажи"
            panels={[
              {
                id: 'bar-retail',
                label: 'Продажа напрямую',
                content: <SaleForm key={JSON.stringify([me.user?.id, me.context, me.sessionIssuedAt, context])} stock={stock.value} context={context} methods={paymentMethods.value.sale} recoveryScope={[me.user?.organizationId ?? '', me.context?.businessId ?? '', me.context?.locationId ?? '', me.user?.id ?? '', context.propertyId, context.currency, me.sessionIssuedAt ?? '']} expiresAt={me.expiresAt ?? ''} />,
              },
              ...(vertical !== 'HOSPITALITY' ? [] : [{
                id: 'bar-folio',
                label: 'В счёт гостя',
                content:
                  folios.value.length === 0 ? (
                    <p className="bar-muted">Открытых счетов нет. Доступна продажа напрямую.</p>
                  ) : (
                    <FolioSaleForm stock={stock.value} folios={folios.value} context={context} />
                  ),
              }]),
            ]}
          />
        </section>
      </SaleDisclosure>
      )}
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
          context={context}
          stock={stock.value}
          categories={categories.value}
          suppliers={suppliers.value}
          movements={movements.value}
          today={today}
          initialProduct={canCatalogMutate ? (productParam ?? null) : null}
          canCatalogMutate={canCatalogMutate}
          canStockMutate={rights.operateStock}
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
