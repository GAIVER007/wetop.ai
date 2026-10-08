import { requireVertical } from '../../lib/vertical-guard';
import { unstable_rethrow } from 'next/navigation';
import { Fragment } from 'react';
import { BarCommandForm } from './command-form';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { hotelApi } from '../../lib/hotel-api';
import { barApi } from '../../lib/api';
import { hotelToday } from '../../lib/hotel-api';
import { formatMoney } from '../../lib/money';
import { Page } from '../../components/page';
import { Badge, Button, EmptyState, SectionTitle, Stat, Stats, Table } from '../../components/ui';
import { Icon } from '../../components/icon';
import { ReceiptForm } from './receipt-form';
import { SaleForm } from './sale-form';
import { postBarReceiptAction, reverseBarSaleAction } from './actions';
import { WriteOffForm } from './write-off-form';
import { SupplierPaymentForm } from './supplier-payment-form';
import { FolioSaleForm } from './folio-sale-form';
import { InventoryCountForm } from './inventory-count-form';
import { BarCatalogs } from './catalogs';
import { ProductPriceForm } from './product-price-form';
import './bar.css';

const settle = <T,>(promise: Promise<T>) =>
  promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const, error };
    },
  );
export default async function BarPage() {
  await requireVertical(['HOSPITALITY']);
  const [
    categories,
    products,
    suppliers,
    receipts,
    stock,
    sales,
    folios,
    movements,
    report,
    today,
    settings,
  ] = await Promise.all([
    settle(barApi.categories()),
    settle(barApi.products()),
    settle(barApi.suppliers()),
    settle(barApi.receipts()),
    settle(barApi.stock()),
    settle(barApi.sales()),
    settle(barApi.folios()),
    settle(barApi.movements()),
    settle(barApi.report()),
    hotelToday(),
    settle(hotelApi.settings()),
  ]);
  const error = [
    categories,
    products,
    suppliers,
    receipts,
    stock,
    sales,
    folios,
    movements,
    report,
    settings,
  ].find((result) => !result.ok);
  if (error && !error.ok)
    return (
      <Page title="Бар">
        <p role="alert">
          {error.error instanceof Error ? error.error.message : 'Данные бара недоступны'}
        </p>
        <LoadError
          {...loadErrorProps(error.error)}
          testId="bar-load-error"
          title="Расчёт бара недоступен"
        />
      </Page>
    );
  if (
    !categories.ok ||
    !products.ok ||
    !suppliers.ok ||
    !receipts.ok ||
    !stock.ok ||
    !sales.ok ||
    !folios.ok ||
    !movements.ok ||
    !report.ok ||
    !settings.ok
  )
    return null;
  const context = {
    propertyId: settings.value.property.id,
    currency: settings.value.property.currency,
  };
  if (
    !context.currency ||
    report.value.currency !== context.currency ||
    stock.value.some((row) => row.currency !== context.currency)
  )
    return (
      <Page title="Бар">
        <p role="alert">
          Валюта ответа не совпадает с выбранным объектом. Денежный расчёт недоступен.
        </p>
      </Page>
    );
  const posted = receipts.value.filter((x) => x.status === 'POSTED');
  return (
    <Page
      width="wide"
      title="Бар"
      subtitle="Приходы, закупочная стоимость, наценка, остатки и долги поставщикам в одном разделе."
    >
      <Fragment key={context.propertyId}>
        <Stats min={190}>
          <Stat
            label="Товары"
            value={products.value.filter((x) => x.active).length}
            hint="активных позиций"
          />
          <Stat
            label="Закупки получено"
            value={formatMoney(report.value.purchasesMinor, report.value.currency)}
            hint={`${posted.length} проведенных приходов`}
          />
          <Stat
            label="Расходы поставщикам"
            value={formatMoney(report.value.supplierPaidMinor, report.value.currency)}
            hint="фактически оплачено из кассы"
          />
          <Stat
            label="Долг поставщикам"
            value={formatMoney(report.value.supplierDebtMinor, report.value.currency)}
            tone={BigInt(report.value.supplierDebtMinor) > 0n ? 'warn' : undefined}
          />
          <Stat
            label="Выручка бара"
            value={formatMoney(report.value.revenueMinor, report.value.currency)}
            hint={`валовая прибыль ${formatMoney(report.value.grossProfitMinor, report.value.currency)}`}
          />
          <Stat
            label="Стоимость остатка"
            value={formatMoney(report.value.stockCostMinor, report.value.currency)}
            hint={`списано ${formatMoney(report.value.writeOffMinor, report.value.currency)}`}
          />
        </Stats>
        <SectionTitle>Продажа без брони</SectionTitle>
        <SaleForm context={context} stock={stock.value} />
        <SectionTitle>Добавить в счет гостя</SectionTitle>
        {folios.value.length === 0 ? (
          <EmptyState icon={<Icon name="guests" />} title="Нет открытых счетов">
            Продажу можно записать без брони выше.
          </EmptyState>
        ) : (
          <FolioSaleForm context={context} stock={stock.value} folios={folios.value} />
        )}
        <SectionTitle>Остатки</SectionTitle>
        <Table>
          <thead>
            <tr>
              <th>Товар</th>
              <th>Остаток</th>
              <th>Минимум</th>
              <th>Своя цена продажи</th>
              <th>Себестоимость остатка</th>
            </tr>
          </thead>
          <tbody>
            {stock.value.map((item) => (
              <tr key={item.id}>
                <td>
                  <b>{item.name}</b>
                  <small>{item.code}</small>
                </td>
                <td>
                  <Badge
                    tone={
                      BigInt(item.availableUnits) <= BigInt(item.minimumStockUnits) ? 'warn' : 'ok'
                    }
                  >
                    {item.availableUnits} шт.
                  </Badge>
                </td>
                <td>{item.minimumStockUnits} шт.</td>
                <td>
                  <ProductPriceForm
                    context={context}
                    productId={item.id}
                    salePrice={item.salePrice}
                  />
                </td>
                <td>{formatMoney(item.stockCostMinor, item.currency)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <SectionTitle>Списание</SectionTitle>
        <WriteOffForm context={context} stock={stock.value} />
        <SectionTitle>Инвентаризация</SectionTitle>
        <InventoryCountForm context={context} stock={stock.value} />
        <SectionTitle>Продажи</SectionTitle>
        {sales.value.length === 0 ? (
          <EmptyState icon={<Icon name="receipt" />} title="Продаж пока нет">
            Первую продажу можно записать выше.
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Товар</th>
                <th>Выручка</th>
                <th>Себестоимость</th>
                <th>Прибыль</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sales.value.map((sale) => (
                <tr key={sale.id}>
                  <td>{sale.createdAt.slice(0, 10)}</td>
                  <td>
                    {sale.lines
                      .map((line) => `${line.product.name} × ${line.quantityUnits}`)
                      .join(', ')}
                  </td>
                  <td>{formatMoney(sale.totalRevenue, sale.currency)}</td>
                  <td>{formatMoney(sale.totalCost, sale.currency)}</td>
                  <td>
                    {formatMoney(BigInt(sale.totalRevenue) - BigInt(sale.totalCost), sale.currency)}
                  </td>
                  <td>
                    <Badge tone={sale.status === 'POSTED' ? 'ok' : 'neutral'}>
                      {sale.status === 'POSTED' ? 'Продано' : 'Возврат'}
                    </Badge>
                  </td>
                  <td>
                    {sale.status === 'POSTED' && (
                      <div className="bar-return">
                        <BarCommandForm context={context} action={reverseBarSaleAction}>
                          <input type="hidden" name="id" value={sale.id} />
                          <input type="hidden" name="restock" value="true" />
                          <input
                            type="hidden"
                            name="reason"
                            value="Возврат гостя, товар пригоден"
                          />
                          <Button type="submit" tone="ghost" size="xs">
                            Вернуть на склад
                          </Button>
                        </BarCommandForm>
                        <BarCommandForm context={context} action={reverseBarSaleAction}>
                          <input type="hidden" name="id" value={sale.id} />
                          <input type="hidden" name="restock" value="false" />
                          <input
                            type="hidden"
                            name="reason"
                            value="Возврат гостя, товар непригоден"
                          />
                          <Button type="submit" tone="ghost" size="xs">
                            Без возврата на склад
                          </Button>
                        </BarCommandForm>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <SectionTitle>Новый приход</SectionTitle>
        <p className="bar-accounting-note">
          <b>Как учитываются деньги:</b> проведение прихода увеличивает склад и фиксирует закупку.
          Расход в кассе появляется только после оплаты поставщику, включая частичную оплату.
        </p>
        {products.value.length === 0 || suppliers.value.length === 0 ? (
          <EmptyState icon={<Icon name="receipt" />} title="Сначала добавьте товары и поставщиков">
            Справочники доступны в настройках бара.
          </EmptyState>
        ) : (
          <ReceiptForm
            context={context}
            products={products.value}
            suppliers={suppliers.value}
            today={today}
          />
        )}
        <SectionTitle>Приходы и долги</SectionTitle>
        {receipts.value.length === 0 ? (
          <EmptyState icon={<Icon name="receipt" />} title="Приходов пока нет">
            Занесите первую счет-фактуру выше.
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Документ</th>
                <th>Поставщик</th>
                <th>Позиций</th>
                <th>Сумма</th>
                <th>Оплачено</th>
                <th>Долг</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {receipts.value.map((receipt) => (
                <tr key={receipt.id}>
                  <td>
                    <b>{receipt.documentNumber}</b>
                    <small>{receipt.receivedDate.slice(0, 10)}</small>
                  </td>
                  <td>{receipt.supplier.name}</td>
                  <td>{receipt._count.lines}</td>
                  <td>{formatMoney(receipt.totalAmount, receipt.currency)}</td>
                  <td>{formatMoney(receipt.paidAmount, receipt.currency)}</td>
                  <td>{formatMoney(receipt.dueAmount, receipt.currency)}</td>
                  <td>
                    <Badge tone={receipt.status === 'POSTED' ? 'ok' : 'neutral'}>
                      {receipt.status === 'POSTED' ? 'Проведен' : 'Черновик'}
                    </Badge>
                  </td>
                  <td>
                    {receipt.status === 'DRAFT' ? (
                      <BarCommandForm context={context} action={postBarReceiptAction}>
                        <input type="hidden" name="id" value={receipt.id} />
                        <Button size="xs" type="submit">
                          Провести
                        </Button>
                      </BarCommandForm>
                    ) : BigInt(receipt.dueAmount) > 0n ? (
                      <SupplierPaymentForm
                        context={context}
                        receiptId={receipt.id}
                        dueAmount={receipt.dueAmount}
                      />
                    ) : (
                      <Badge tone="ok">Оплачено</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <SectionTitle>Движения</SectionTitle>
        <Table>
          <thead>
            <tr>
              <th>Время</th>
              <th>Товар</th>
              <th>Тип</th>
              <th>Кол-во</th>
              <th>Себестоимость</th>
              <th>Причина</th>
            </tr>
          </thead>
          <tbody>
            {movements.value.map((movement) => (
              <tr key={movement.id}>
                <td>{movement.createdAt.slice(0, 16).replace('T', ' ')}</td>
                <td>{movement.product.name}</td>
                <td>{movement.kind}</td>
                <td>{movement.units}</td>
                <td>{formatMoney(movement.amountMinor, context.currency)}</td>
                <td>{movement.note ?? '–'}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <SectionTitle>Справочники бара</SectionTitle>
        <BarCatalogs
          context={context}
          categories={categories.value}
          products={products.value}
          suppliers={suppliers.value}
        />
      </Fragment>
    </Page>
  );
}
