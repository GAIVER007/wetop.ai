import Link from 'next/link';
import { requireVertical } from '../../../lib/vertical-guard';
import { unstable_rethrow } from 'next/navigation';
import { barApi } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import { Page } from '../../../components/page';
import { Badge, Button, EmptyState, SectionTitle, Table } from '../../../components/ui';
import { Icon } from '../../../components/icon';
import { toggleBarCatalogAction } from '../actions';
import { SupplierForm } from './supplier-form';
import { BarTabs } from '../tabs';
import '../bar.css';

const settle = <T,>(promise: Promise<T>) => promise.then((value) => ({ ok: true as const, value }), (error: unknown) => { unstable_rethrow(error); return { ok: false as const, error }; });

/** Поставщики бара (ADR-156): контакты, закуплено и оплачено по каждому, долг; оплата живёт в «Приходах». */
export default async function BarSuppliersPage() {
  await requireVertical(['HOSPITALITY']);
  const [suppliers, receipts] = await Promise.all([settle(barApi.suppliers()), settle(barApi.receipts())]);
  const failed = [suppliers, receipts].find((result) => !result.ok);
  if (failed && !failed.ok) throw failed.error;
  if (!suppliers.ok || !receipts.ok) return null;
  const totals = new Map<string, { purchased: bigint; paid: bigint; due: bigint; documents: number }>();
  for (const receipt of receipts.value) {
    if (receipt.status !== 'POSTED') continue;
    const entry = totals.get(receipt.supplier.id) ?? { purchased: 0n, paid: 0n, due: 0n, documents: 0 };
    entry.purchased += BigInt(receipt.totalAmount);
    entry.paid += BigInt(receipt.paidAmount);
    entry.due += BigInt(receipt.dueAmount);
    entry.documents += 1;
    totals.set(receipt.supplier.id, entry);
  }
  const rows = [...suppliers.value].sort((a, b) =>
    a.active === b.active ? a.name.localeCompare(b.name, 'ru') : a.active ? -1 : 1);
  return <Page width="wide" title="Бар: поставщики" subtitle="Контакты и расчёты: закуплено, оплачено и долг по каждому поставщику.">
    <BarTabs current="suppliers" />
    <section className="panel bar-supplier-panel">
      <h3>Новый поставщик</h3>
      <SupplierForm />
    </section>
    <section className="bar-suppliers-table">
      <SectionTitle>Поставщики и расчёты</SectionTitle>
      {rows.length === 0
        ? <EmptyState icon={<Icon name="guests" />} title="Поставщиков пока нет">Добавьте первого в форме выше: без поставщика не завести приход.</EmptyState>
        : <Table density="compact" sticky="header" aria-label="Поставщики бара">
            <thead><tr><th>Поставщик</th><th>Контакты</th><th>Приходов</th><th>Закуплено</th><th>Оплачено</th><th>Долг</th><th /></tr></thead>
            <tbody>{rows.map((supplier) => {
              const total = totals.get(supplier.id);
              return <tr key={supplier.id} className={supplier.active ? undefined : 'is-void'}>
                <td><b>{supplier.name}</b></td>
                <td>{[supplier.phone, supplier.email].filter(Boolean).join(', ') || 'нет'}</td>
                <td>{total?.documents ?? 0}</td>
                <td>{formatMoney((total?.purchased ?? 0n).toString())}</td>
                <td>{formatMoney((total?.paid ?? 0n).toString())}</td>
                <td>{total && total.due > 0n
                  ? <Badge tone="warn">{formatMoney(total.due.toString())}</Badge>
                  : formatMoney('0')}</td>
                <td className="bar-supplier-actions">
                  {total && total.due > 0n && <Link className="btn btn--secondary btn--xs" href="/bar/receipts" prefetch={false}>К оплате</Link>}
                  <form action={toggleBarCatalogAction}>
                    <input type="hidden" name="kind" value="supplier" />
                    <input type="hidden" name="id" value={supplier.id} />
                    <input type="hidden" name="active" value={String(!supplier.active)} />
                    <Button type="submit" tone="ghost" size="xs">{supplier.active ? 'В архив' : 'Восстановить'}</Button>
                  </form>
                </td>
              </tr>;
            })}</tbody>
          </Table>}
    </section>
  </Page>;
}
