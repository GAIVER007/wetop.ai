import { requireVertical } from '../../../lib/vertical-guard';
import { unstable_rethrow } from 'next/navigation';
import { barApi } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import { Page } from '../../../components/page';
import { Badge, Button, EmptyState, SectionTitle, Table } from '../../../components/ui';
import { Icon } from '../../../components/icon';
import { reverseBarSaleAction } from '../actions';
import { WriteOffForm } from '../write-off-form';
import { InventoryCountForm } from '../inventory-count-form';
import { BarTabs } from '../tabs';
import '../bar.css';

const settle = <T,>(promise: Promise<T>) => promise.then((value) => ({ ok: true as const, value }), (error: unknown) => { unstable_rethrow(error); return { ok: false as const, error }; });

const MOVEMENT_LABEL: Record<string, string> = {
  RECEIPT: 'Приход',
  SALE: 'Продажа',
  WRITE_OFF: 'Списание',
  SALE_RETURN: 'Возврат',
  INVENTORY_ADJUSTMENT: 'Инвентаризация',
};

/** Операции бара (ADR-156): списание, инвентаризация, журнал продаж с возвратами и лента движений. */
export default async function BarOperationsPage() {
  await requireVertical(['HOSPITALITY']);
  const [stock, sales, movements] = await Promise.all([
    settle(barApi.stock()), settle(barApi.sales()), settle(barApi.movements()),
  ]);
  const failed = [stock, sales, movements].find((result) => !result.ok);
  if (failed && !failed.ok) throw failed.error;
  if (!stock.ok || !sales.ok || !movements.ok) return null;
  return <Page width="wide" title="Бар: операции" subtitle="Списание и инвентаризация, журнал продаж с возвратами, лента движений остатка.">
    <BarTabs current="operations" />
    <div className="bar-quick">
      <section className="panel bar-quick-panel">
        <h3>Списание</h3>
        <p className="bar-muted">Порча, бой, срок или угощение: остаток уменьшится с причиной в ленте.</p>
        <WriteOffForm stock={stock.value} />
      </section>
      <section className="panel bar-quick-panel">
        <h3>Инвентаризация</h3>
        <p className="bar-muted">Пересчёт по факту: недостача запишется движением с причиной.</p>
        <InventoryCountForm stock={stock.value} />
      </section>
    </div>
    <SectionTitle>Продажи</SectionTitle>
    {sales.value.length === 0
      ? <EmptyState icon={<Icon name="receipt" />} title="Продаж пока нет">Первую продажу можно записать на «Обзоре».</EmptyState>
      : <Table density="compact" sticky="header" aria-label="Продажи бара">
          <thead><tr><th>Дата</th><th>Товар</th><th>Выручка</th><th>Себестоимость</th><th>Прибыль</th><th>Статус</th><th /></tr></thead>
          <tbody>{sales.value.map((sale) => <tr key={sale.id}>
            <td>{sale.createdAt.slice(0, 10)}</td>
            <td>{sale.lines.map((line) => `${line.product.name} × ${line.quantityUnits}`).join(', ')}</td>
            <td>{formatMoney(sale.totalRevenue)}</td>
            <td>{formatMoney(sale.totalCost)}</td>
            <td>{formatMoney(BigInt(sale.totalRevenue) - BigInt(sale.totalCost))}</td>
            <td><Badge tone={sale.status === 'POSTED' ? 'ok' : 'neutral'}>{sale.status === 'POSTED' ? 'Продано' : 'Возврат'}</Badge></td>
            <td>{sale.status === 'POSTED' && <div className="bar-return">
              <form action={reverseBarSaleAction}><input type="hidden" name="id" value={sale.id} /><input type="hidden" name="restock" value="true" /><input type="hidden" name="reason" value="Возврат гостя, товар пригоден" /><Button type="submit" tone="ghost" size="xs">Вернуть на склад</Button></form>
              <form action={reverseBarSaleAction}><input type="hidden" name="id" value={sale.id} /><input type="hidden" name="restock" value="false" /><input type="hidden" name="reason" value="Возврат гостя, товар непригоден" /><Button type="submit" tone="ghost" size="xs">Без возврата на склад</Button></form>
            </div>}</td>
          </tr>)}</tbody>
        </Table>}
    <SectionTitle>Движения</SectionTitle>
    {movements.value.length === 0
      ? <EmptyState icon={<Icon name="journal" />} title="Движений пока нет">Лента заполнится с первым приходом или продажей.</EmptyState>
      : <Table density="compact" sticky="header" aria-label="Движения остатка бара">
          <thead><tr><th>Время</th><th>Товар</th><th>Тип</th><th>Кол-во</th><th>Себестоимость</th><th>Причина</th></tr></thead>
          <tbody>{movements.value.map((movement) => <tr key={movement.id}>
            <td>{movement.createdAt.slice(0, 16).replace('T', ' ')}</td>
            <td>{movement.product.name}</td>
            <td>{MOVEMENT_LABEL[movement.kind] ?? movement.kind}</td>
            <td>{movement.units}</td>
            <td>{formatMoney(movement.amountMinor)}</td>
            <td>{movement.note ?? 'нет'}</td>
          </tr>)}</tbody>
        </Table>}
  </Page>;
}
