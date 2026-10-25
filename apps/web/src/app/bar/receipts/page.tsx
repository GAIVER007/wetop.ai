import Link from 'next/link';
import { displayDate } from '../../../lib/display-date';
import { requireFeature } from '../../../lib/vertical-guard';
import { unstable_rethrow } from 'next/navigation';
import { barApi } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import { Page } from '../../../components/page';
import { Badge, Button, EmptyState, Table } from '../../../components/ui';
import { Icon } from '../../../components/icon';
import { postBarReceiptAction } from '../actions';
import { loadBarContext } from '../load-context';
import { BarCommandForm } from '../command-form';
import { SupplierPaymentForm } from '../supplier-payment-form';
import { BarTabs } from '../tabs';
import { deskShell } from '../../../lib/desk-shell';
import { barActionAccess } from '../action-access';
import '../bar.css';
import { serverT } from '../../../i18n/server';

const settle = <T,>(promise: Promise<T>) => promise.then((value) => ({ ok: true as const, value }), (error: unknown) => { unstable_rethrow(error); return { ok: false as const, error }; });

/** Приходы бара (ADR-157): журнал документов поставщиков, проведение черновиков, оплата и долги. */
export default async function BarReceiptsPage() {
  await requireFeature('/bar/receipts');
  const t = await serverT();
  const [receipts, methods, shell] = await Promise.all([settle(barApi.receipts()), settle(barApi.paymentMethods()), deskShell()]);
  // UI-FIX-01: проведение и оплата прихода пишут склад и кассу, нужны право desk и не режим чтения.
  const rights = barActionAccess(shell, shell.vertical);
  if (!receipts.ok) throw receipts.error;
  if (!methods.ok) throw methods.error;
  // контекст денежных форм: сервер сверяет объект и валюту (D-CUR); у салона вместо объекта филиал
  const context = await loadBarContext();
  // раздел меню «Склад» у всех направлений (решение владельца 19.10.2026)
  return <Page width="wide" className="bar-subpage" title={t('Склад: приходы')} subtitle={t('Документы поставщиков: черновики, проведённые приходы, оплата и долг.')} actions={rights.receiveStock ?
    <Link className="btn" href="/bar/receipts/new" prefetch={false}>{t('Новый приход')}</Link>
  : undefined}>
    <BarTabs current="receipts" />
    <details className="bar-details"><summary>{t('Как учитываются деньги')}</summary><p className="bar-accounting-note"> {t('проведение прихода увеличивает склад и фиксирует закупку. Расход в кассе появляется только после оплаты поставщику, включая частичную оплату.')}</p></details>
    {receipts.value.length === 0
      ? <EmptyState icon={<Icon name="receipt" />} title={t('Приходов пока нет')}>{t('Занесите первую счёт-фактуру: кнопка «Новый приход».')}</EmptyState>
      : <Table density="compact" sticky="header" stack aria-label={shell.vertical === 'BEAUTY' ? t('Приходы склада') : t('Приходы бара')}>
          <thead><tr><th>{t('Документ')}</th><th>{t('Поставщик')}</th><th>{t('Сумма')}</th><th>{t('Долг')}</th><th>{t('Статус')}</th><th /></tr></thead>
          <tbody>{receipts.value.map((receipt) => <tr key={receipt.id}>
            <td data-label={t('Документ')}><b>{receipt.documentNumber}</b> <small>{displayDate(receipt.receivedDate.slice(0, 10))}</small><small>{t('{n} позиций', { n: receipt._count.lines })}</small></td>
            <td data-label={t('Поставщик')}>{receipt.supplier.name}</td>
            <td data-label={t('Сумма')}>{formatMoney(receipt.totalAmount, context.currency)}<small>{t('Оплачено: {amount}', { amount: formatMoney(receipt.paidAmount, context.currency) })}</small></td>
            <td data-label={t('Долг')}>{formatMoney(receipt.dueAmount, context.currency)}</td>
            <td data-label={t('Статус')}><Badge tone={receipt.status === 'POSTED' ? 'ok' : 'neutral'}>{receipt.status === 'POSTED' ? t('Проведён') : t('Черновик')}</Badge></td>
            <td>{receipt.status === 'DRAFT' && rights.operateStock
              ? <BarCommandForm context={context} action={postBarReceiptAction}><input type="hidden" name="id" value={receipt.id} /><Button size="xs" type="submit">{t('Провести')}</Button></BarCommandForm>
              : receipt.status !== 'DRAFT' && BigInt(receipt.dueAmount) > 0n && rights.createFinance
                ? <SupplierPaymentForm receiptId={receipt.id} dueAmount={receipt.dueAmount} context={context} methods={methods.value.supplier} />
                : receipt.status !== 'DRAFT' && BigInt(receipt.dueAmount) <= 0n
                  ? <Badge tone="ok">{t('Оплачено')}</Badge>
                  : null}</td>
          </tr>)}</tbody>
        </Table>}
  </Page>;
}
