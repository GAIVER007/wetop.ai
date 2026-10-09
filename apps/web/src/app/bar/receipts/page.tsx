import Link from 'next/link';
import { requireVertical } from '../../../lib/vertical-guard';
import { unstable_rethrow } from 'next/navigation';
import { barApi } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import { Page } from '../../../components/page';
import { Badge, Button, EmptyState, Table } from '../../../components/ui';
import { Icon } from '../../../components/icon';
import { postBarReceiptAction } from '../actions';
import { SupplierPaymentForm } from '../supplier-payment-form';
import { BarTabs } from '../tabs';
import '../bar.css';

const settle = <T,>(promise: Promise<T>) => promise.then((value) => ({ ok: true as const, value }), (error: unknown) => { unstable_rethrow(error); return { ok: false as const, error }; });

/** Приходы бара (ADR-152): журнал документов поставщиков, проведение черновиков, оплата и долги. */
export default async function BarReceiptsPage() {
  await requireVertical(['HOSPITALITY']);
  const receipts = await settle(barApi.receipts());
  if (!receipts.ok) throw receipts.error;
  return <Page width="wide" title="Бар: приходы" subtitle="Документы поставщиков: черновики, проведённые приходы, оплата и долг." actions={
    <Link className="btn" href="/bar/receipts/new" prefetch={false}>Новый приход</Link>
  }>
    <BarTabs current="receipts" />
    <p className="bar-accounting-note"><b>Как учитываются деньги:</b> проведение прихода увеличивает склад и фиксирует закупку. Расход в кассе появляется только после оплаты поставщику, включая частичную оплату.</p>
    {receipts.value.length === 0
      ? <EmptyState icon={<Icon name="receipt" />} title="Приходов пока нет">Занесите первую счёт-фактуру: кнопка «Новый приход».</EmptyState>
      : <Table density="compact" sticky="header" aria-label="Приходы бара">
          <thead><tr><th>Документ</th><th>Поставщик</th><th>Позиций</th><th>Сумма</th><th>Оплачено</th><th>Долг</th><th>Статус</th><th /></tr></thead>
          <tbody>{receipts.value.map((receipt) => <tr key={receipt.id}>
            <td><b>{receipt.documentNumber}</b><small>{receipt.receivedDate.slice(0, 10)}</small></td>
            <td>{receipt.supplier.name}</td>
            <td>{receipt._count.lines}</td>
            <td>{formatMoney(receipt.totalAmount)}</td>
            <td>{formatMoney(receipt.paidAmount)}</td>
            <td>{formatMoney(receipt.dueAmount)}</td>
            <td><Badge tone={receipt.status === 'POSTED' ? 'ok' : 'neutral'}>{receipt.status === 'POSTED' ? 'Проведён' : 'Черновик'}</Badge></td>
            <td>{receipt.status === 'DRAFT'
              ? <form action={postBarReceiptAction}><input type="hidden" name="id" value={receipt.id} /><Button size="xs" type="submit">Провести</Button></form>
              : BigInt(receipt.dueAmount) > 0n
                ? <SupplierPaymentForm receiptId={receipt.id} dueAmount={receipt.dueAmount} />
                : <Badge tone="ok">Оплачено</Badge>}</td>
          </tr>)}</tbody>
        </Table>}
  </Page>;
}
