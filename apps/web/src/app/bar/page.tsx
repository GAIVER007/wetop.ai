import Link from 'next/link';
import { requireFeature } from '../../lib/vertical-guard';
import { stockWords } from '../../lib/stock-words';
import { unstable_rethrow } from 'next/navigation';
import { barApi, type BarReport, type BarSaleRow } from '../../lib/api';
import { hotelToday, propertyTimezone } from '../../lib/hotel-api';
import { formatMoney } from '../../lib/money';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { Tabs } from '../../components/tabs';
import { BarTabs } from './tabs';
import { loadBarContext } from './load-context';
import { Icon } from '../../components/icon';
import { SaleForm } from './sale-form';
import { FolioSaleForm } from './folio-sale-form';
import { StockBoard } from './stock-board';
import { stockStatusOf } from './stock-status';
import { AnalyticsDisclosure } from './analytics-disclosure';
import { SaleDialog } from './sale-disclosure';
import { BarAnalytics } from './bar-analytics';
import { OverviewEmpty, ReceiptsAside } from './overview-parts';
import { deskShell } from '../../lib/desk-shell';
import { barActionAccess } from './action-access';
import './bar.css';
import { countLabel, intlLocale, msg } from '../../i18n';
import { currentLocale, serverT } from '../../i18n/server';
import { dateFormat } from '../../i18n/dates';

const settle = <T,>(promise: Promise<T>) =>
  promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const, error };
    },
  );

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
  const t = await serverT();
  const locale = await currentLocale();
  // бар филиала (ADR-178): «в счёт гостя» только у гостиницы; ресторан и салон продают в кассу филиала (§45, §48)
  const vertical = me.context?.vertical ?? 'HOSPITALITY';
  // раздел меню «Склад» у всех направлений (решение владельца 19.10.2026)
  // решение владельца 24.10.2026: «Склад: бар» у всех направлений
  const sectionName = t(stockWords(vertical).goodsTitle);
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
      <Page width="wide" className="bar-page" title={sectionName}>
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
  // «Октябрь 2026 г.»: заглавная только у первой буквы, без text-transform (аудит 21.10.2026 п.28)
  const monthName = r.month
    ? dateFormat(intlLocale(locale), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
        new Date(`${r.month.monthStart}T12:00:00Z`),
      )
    : t('текущий месяц');
  const monthLabel = monthName.charAt(0).toLocaleUpperCase('ru') + monthName.slice(1);
  const periodWord = r.month ? t('За {month}', { month: monthName }) : t('За всё время');
  const saleForm = (
    <SaleForm key={JSON.stringify([me.user?.id, me.context, me.sessionIssuedAt, context])} stock={stock.value} context={context} methods={paymentMethods.value.sale} recoveryScope={[me.user?.organizationId ?? '', me.context?.businessId ?? '', me.context?.locationId ?? '', me.user?.id ?? '', context.propertyId, context.currency, me.sessionIssuedAt ?? '']} expiresAt={me.expiresAt ?? ''} />
  );
  // итоги месяца одной строкой сразу под шапкой, без плиток (аудит 21.10.2026 п.7, владелец 25.10.2026)
  const totals = (
    <p className="bar-totals" data-testid="bar-totals">
      <span>{periodWord}:</span>
      <span>{t('закупки')} <b data-testid="bar-total-purchases">{money(r.month?.purchasesMinor ?? r.purchasesMinor)}</b></span>
      <span>{t('выручка')} <b data-testid="bar-total-revenue">{money(monthRevenue)}</b></span>
      <span>{t('прибыль от продаж')} <b data-testid="bar-total-profit">{money(monthProfit)}</b> {t('(без прочих расходов)')}</span>
      <span>{t('долг поставщикам')} <b data-testid="bar-total-debt">{money(r.supplierDebtMinor)}</b></span>
    </p>
  );
  // приходы колонкой справа от остатков, без раскрывашки (владелец 25.10.2026)
  const receiptsAside = <ReceiptsAside receipts={lastReceipts} currency={r.currency} />;
  return (
    <Page
      width="wide"
      className="bar-page"
      title={sectionName}
      actions={
        <>
          {rights.receiveStock && (
              <Link className="btn" href="/bar/receipts/new" prefetch={false}>
                <Icon name="plus" width={16} height={16} /> {t('Приход')}
              </Link>
          )}
          {rights.createCatalog && (
              <Link className="btn btn--secondary" href="/bar/products#new-product" prefetch={false}>
                <Icon name="plus" width={16} height={16} /> {t('Новый товар')}
              </Link>
          )}
          {canSell && (
              <a className="btn btn--secondary" href="#bar-quick-sale">
                <Icon name="plus" width={16} height={16} /> {t('Продажа')}
              </a>
          )}
          {rights.operateStock && (
              <Link
                className="btn btn--secondary"
                href="/bar/operations#bar-inventory"
                prefetch={false}
              >
                <Icon name="plus" width={16} height={16} /> {t('Инвентаризация')}
              </Link>
          )}
          <span className="bar-period-label">
            <Icon name="board" width={16} height={16} />
            {monthLabel}
          </span>
        </>
      }
    >
      <nav className="bar-mobile-actions" aria-label={vertical === 'BEAUTY' ? t('Быстрые действия склада') : t('Быстрые действия бара')}>
        {rights.receiveStock && <Link href="/bar/receipts/new" className="btn btn--secondary" prefetch={false}>
          {t('Приход')}
        </Link>}
        {canSell && <a href="#bar-quick-sale" className="btn">
          {t('Продажа')}
        </a>}
        {rights.operateStock && <Link
          href="/bar/operations#bar-inventory"
          className="btn btn--secondary"
          prefetch={false}
          aria-label={t('Инвентаризация')}
        >
          {t('Пересчёт')}
        </Link>}
      </nav>
      <BarTabs current="bar" />
      {totals}
      {/* без плиток над списком (правило владельца, аудит 21.10.2026 п.7): предупреждение строкой, только когда есть что сказать */}
      {lowCount > 0 && (
        <p className="bar-low-warning" role="status" data-testid="bar-low-warning">
          <Icon name="incidents" width={16} height={16} />
          <span>
            {t('Заканчиваются: {count}.', { count: countLabel(locale, t, lowCount, [msg('товар'), 'товара', msg('товаров')]) })}{' '} {/* kk-allow: формы склонения для русского вида */}
            {lowStock.slice(0, 5).map((item, index) => (
              <span key={item.id}>
                {index > 0 && ', '}
                <Link href={`/bar?product=${item.id}`} prefetch={false}>{item.name}</Link> ({t('{n} шт.', { n: item.availableUnits })})
              </span>
            ))}
            {lowCount > 5 && ` ${t('и другие')}`}
          </span>
        </p>
      )}
      <AnalyticsDisclosure>
        <BarAnalytics
          sales={sales.value}
          stock={stock.value}
          popular={popular}
          timezone={timezone}
        />
      </AnalyticsDisclosure>
      {canSell && (
        // одна кнопка «Продажа» в шапке открывает окно продажи (аудит 21.10.2026 п.13); вкладки только у гостиницы
        <SaleDialog title={vertical === 'HOSPITALITY' ? t('Продажа') : t('Продажа напрямую')}>
          <section className="bar-sales" aria-label={vertical === 'BEAUTY' ? t('Продажи склада') : t('Продажи бара')}>
            {vertical === 'HOSPITALITY' ? (
              <Tabs
                label={t('Способ продажи')}
                panels={[
                  { id: 'bar-retail', label: t('Продажа напрямую'), content: saleForm },
                  {
                    id: 'bar-folio',
                    label: t('В счёт гостя'),
                    content:
                      folios.value.length === 0 ? (
                        <p className="bar-muted">{t('Открытых счетов нет. Доступна продажа напрямую.')}</p>
                      ) : (
                        <FolioSaleForm stock={stock.value} folios={folios.value} context={context} />
                      ),
                  },
                ]}
              />
            ) : (
              saleForm
            )}
          </section>
        </SaleDialog>
      )}
      {/* остатки 2fr и приходы 1fr в один ряд, чтобы обзор помещался на один экран ПК (владелец 25.10.2026) */}
      <div className="bar-overview-grid">
        {stock.value.length === 0 ? (
          <OverviewEmpty canCreate={rights.createCatalog} canReceive={rights.receiveStock} />
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
            bottom={null}
          />
        )}
        {receiptsAside}
      </div>
    </Page>
  );
}
