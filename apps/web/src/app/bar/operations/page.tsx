import { requireVertical } from '../../../lib/vertical-guard';
import { unstable_rethrow } from 'next/navigation';
import { deskShell } from '../../../lib/desk-shell';
import { mayAccess } from '../../../lib/navigation';
import { barApi } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import { Tabs } from '../../../components/tabs';
import { Page } from '../../../components/page';
import { Badge, EmptyState, SectionTitle, Table } from '../../../components/ui';
import { Icon } from '../../../components/icon';
import { BarReturnButtons } from '../return-buttons';
import { WriteOffForm } from '../write-off-form';
import { InventoryCountForm } from '../inventory-count-form';
import { BarTabs } from '../tabs';
import { loadBarContext } from '../load-context';
import '../bar.css';

const settle = <T,>(promise: Promise<T>) =>
  promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const, error };
    },
  );

const MOVEMENT_LABEL: Record<string, string> = {
  RECEIPT: 'Приход',
  SALE: 'Продажа',
  WRITE_OFF: 'Списание',
  SALE_RETURN: 'Возврат',
  INVENTORY_ADJUSTMENT: 'Инвентаризация',
};

/** Операции бара (ADR-157): списание, инвентаризация, журнал продаж с возвратами и лента движений. */
export default async function BarOperationsPage() {
  await requireVertical(['HOSPITALITY', 'FOOD_SERVICE', 'BEAUTY']);
  const [stock, sales, movements, shell] = await Promise.all([
    settle(barApi.stock()),
    settle(barApi.sales()),
    settle(barApi.movements()),
    deskShell(),
  ]);
  // Сохраняем проверку refunds и readOnly из актуального main (ADR-181).
  const canReverse = mayAccess(shell.access, 'refunds') && !shell.readOnly;
  const failed = [stock, sales, movements].find((result) => !result.ok);
  if (failed && !failed.ok) throw failed.error;
  if (!stock.ok || !sales.ok || !movements.ok) return null;
  // контекст денежных форм: сервер сверяет объект и валюту (D-CUR); у салона вместо объекта филиал
  const context = await loadBarContext();
  return (
    <Page
      width="wide"
      className="bar-subpage"
      title="Бар: операции"
      subtitle="Списание и инвентаризация, журнал продаж с возвратами, лента движений остатка."
    >
      <BarTabs current="operations" />
      <Tabs
        label="Операции бара"
        panels={[
          {
            id: 'bar-sales',
            label: 'Продажи',
            content: (
              <>
                {' '}
                <SectionTitle>Продажи</SectionTitle>
                {sales.value.length === 0 ? (
                  <EmptyState icon={<Icon name="receipt" />} title="Продаж пока нет">
                    Первую продажу можно записать на «Обзоре».
                  </EmptyState>
                ) : (
                  <Table density="compact" sticky="header" aria-label="Продажи бара">
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
                          <td>{formatMoney(sale.totalRevenue, context.currency)}</td>
                          <td>{formatMoney(sale.totalCost, context.currency)}</td>
                          <td>{formatMoney(BigInt(sale.totalRevenue) - BigInt(sale.totalCost), context.currency)}</td>
                          <td>
                            <Badge tone={sale.status === 'POSTED' ? 'ok' : 'neutral'}>
                              {sale.status === 'POSTED' ? 'Продано' : 'Возврат'}
                            </Badge>
                          </td>
                          <td>
                            {sale.status === 'POSTED' && canReverse && (
                              <BarReturnButtons
                                saleId={sale.id}
                                context={context}
                                amountText={formatMoney(sale.totalRevenue, context.currency)}
                              />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </>
            ),
          },
          {
            id: 'bar-movements',
            label: 'Движения',
            content: (
              <>
                {' '}
                <SectionTitle>Движения</SectionTitle>
                {movements.value.length === 0 ? (
                  <EmptyState icon={<Icon name="journal" />} title="Движений пока нет">
                    Лента заполнится с первым приходом или продажей.
                  </EmptyState>
                ) : (
                  <Table density="compact" sticky="header" aria-label="Движения остатка бара">
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
                          <td>{MOVEMENT_LABEL[movement.kind] ?? movement.kind}</td>
                          <td>{movement.units}</td>
                          <td>{formatMoney(movement.amountMinor, context.currency)}</td>
                          <td>{movement.note ?? 'нет'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </>
            ),
          },
          {
            id: 'bar-writeoff',
            label: 'Списание',
            content: (
              <>
                <section className="panel bar-quick-panel">
                  <h3>Списание</h3>
                  <p className="bar-muted">
                    Порча, бой, срок или угощение: остаток уменьшится с причиной в ленте.
                  </p>
                  <WriteOffForm stock={stock.value} context={context} />
                </section>
              </>
            ),
          },
          {
            id: 'bar-inventory',
            label: 'Инвентаризация',
            content: (
              <>
                <section className="panel bar-quick-panel">
                  <h3>Инвентаризация</h3>
                  <p className="bar-muted">
                    Пересчёт по факту: недостача запишется движением с причиной.
                  </p>
                  <InventoryCountForm stock={stock.value} context={context} />
                </section>
              </>
            ),
          },
        ]}
      />
    </Page>
  );
}
