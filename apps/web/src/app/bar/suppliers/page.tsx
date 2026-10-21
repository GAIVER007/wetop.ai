import { can } from '@pms/domain';
import { deskShellOf } from '../../../lib/desk-person';
import Link from 'next/link';
import { requireFeature } from '../../../lib/vertical-guard';
import { unstable_rethrow } from 'next/navigation';
import { barApi } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import { Page } from '../../../components/page';
import { Badge, Button, EmptyState, SectionTitle, Table } from '../../../components/ui';
import { Icon } from '../../../components/icon';
import { toggleBarCatalogAction } from '../actions';
import { loadBarContext } from '../load-context';
import { BarCommandForm } from '../command-form';
import { SupplierForm } from './supplier-form';
import { BarTabs } from '../tabs';
import { CatalogDialog } from '../catalog-dialog';
import { deskShell } from '../../../lib/desk-shell';
import { barActionAccess } from '../action-access';
import '../bar.css';

const settle = <T,>(promise: Promise<T>) => promise.then((value) => ({ ok: true as const, value }), (error: unknown) => { unstable_rethrow(error); return { ok: false as const, error }; });

/** Поставщики бара (ADR-157): контакты, закуплено и оплачено по каждому, долг; оплата живёт в «Приходах». */
export default async function BarSuppliersPage() {
  await requireFeature('/bar/suppliers');
  const [suppliers, receipts, shell] = await Promise.all([settle(barApi.suppliers()), settle(barApi.receipts()), deskShell()]);
  // UI-FIX-01: справочник правит право settings, в режиме чтения команд нет.
  const rights = barActionAccess(shell, shell.vertical);
  const failed = [suppliers, receipts].find((result) => !result.ok);
  if (failed && !failed.ok) throw failed.error;
  if (!suppliers.ok || !receipts.ok) return null;
  // контекст денежных форм: сервер сверяет объект и валюту (D-CUR); у салона вместо объекта филиал
  const context = await loadBarContext();
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
  // раздел меню «Склад» у всех направлений (решение владельца 19.10.2026)
  const sectionName = 'Склад';
  return <Page width="wide" className="bar-subpage" title={`${sectionName}: поставщики`} subtitle="Контакты и расчёты: закуплено, оплачено и долг по каждому поставщику." actions={rights.createCatalog ? (
      <CatalogDialog label="Новый поставщик">
        <SupplierForm context={context} />
      </CatalogDialog>
    ) : undefined}>
    <BarTabs current="suppliers" />
    <section className="bar-suppliers-table">
      <SectionTitle>Поставщики и расчёты</SectionTitle>
      {rows.length === 0
        ? <EmptyState icon={<Icon name="guests" />} title="Поставщиков пока нет">Добавьте первого кнопкой «Новый поставщик» вверху: без поставщика не завести приход.</EmptyState>
        : <Table density="compact" sticky="header" aria-label={`Поставщики ${shell.vertical === 'BEAUTY' ? 'склада' : 'бара'}`}>
            <thead><tr><th>Поставщик</th><th>Контакты</th><th>Долг</th><th>Расчёты</th><th>Действия</th></tr></thead>
            <tbody>{rows.map((supplier) => {
              const total = totals.get(supplier.id);
              return <tr key={supplier.id} className={supplier.active ? undefined : 'is-void'}>
                <td><b>{supplier.name}</b></td>
                <td>{[supplier.phone, supplier.email].filter(Boolean).join(', ') || 'нет'}</td>
                <td>{total && total.due > 0n
                  ? <Badge tone="warn">{formatMoney(total.due.toString(), context.currency)}</Badge>
                  : formatMoney('0', context.currency)}</td>
                <td><details className="bar-row-details"><summary>Расчёты</summary><p>Приходов: {total?.documents ?? 0}</p><p>Закуплено: {formatMoney((total?.purchased ?? 0n).toString(), context.currency)}</p><p>Оплачено: {formatMoney((total?.paid ?? 0n).toString(), context.currency)}</p></details></td>
                <td className="bar-supplier-actions">
                  {total && total.due > 0n && <Link className="btn btn--secondary btn--xs" href="/bar/receipts" prefetch={false}>К оплате</Link>}
                  {rights.archiveCatalog && <BarCommandForm context={context} action={toggleBarCatalogAction}>
                    <input type="hidden" name="kind" value="supplier" />
                    <input type="hidden" name="id" value={supplier.id} />
                    <input type="hidden" name="active" value={String(!supplier.active)} />
                    <Button type="submit" tone="ghost" size="xs">{supplier.active ? 'В архив' : 'Восстановить'}</Button>
                  </BarCommandForm>}
                </td>
              </tr>;
            })}</tbody>
          </Table>}
    </section>
  </Page>;
}
