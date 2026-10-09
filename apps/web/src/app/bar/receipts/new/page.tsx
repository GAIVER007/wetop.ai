import Link from 'next/link';
import { requireVertical } from '../../../../lib/vertical-guard';
import { unstable_rethrow } from 'next/navigation';
import { barApi } from '../../../../lib/api';
import { hotelToday } from '../../../../lib/hotel-api';
import { Page } from '../../../../components/page';
import { EmptyState } from '../../../../components/ui';
import { Icon } from '../../../../components/icon';
import { NewReceipt } from './new-receipt';
import { BarTabs } from '../../tabs';
import '../../bar.css';

const settle = <T,>(promise: Promise<T>) => promise.then((value) => ({ ok: true as const, value }), (error: unknown) => { unstable_rethrow(error); return { ok: false as const, error }; });

/**
 * Новый приход (ADR-156): шапка документа, строки и ИИ-скан накладной. Товара нет в справочнике:
 * карточка заводится прямо из строки и создаётся вместе с приходом.
 */
export default async function BarNewReceiptPage() {
  await requireVertical(['HOSPITALITY']);
  const [products, suppliers, today] = await Promise.all([
    settle(barApi.products()), settle(barApi.suppliers()), hotelToday(),
  ]);
  const failed = [products, suppliers].find((result) => !result.ok);
  if (failed && !failed.ok) throw failed.error;
  if (!products.ok || !suppliers.ok) return null;
  return <Page width="wide" title="Новый приход" subtitle="Счёт-фактура или накладная поставщика: загрузите фото, ИИ заполнит строки, либо внесите руками." crumbs={
    <Link href="/bar/receipts" prefetch={false}>← Приходы</Link>
  }>
    <BarTabs current="receipts" />
    {suppliers.value.filter((supplier) => supplier.active).length === 0
      ? <EmptyState icon={<Icon name="guests" />} title="Сначала добавьте поставщика">Приход привязывается к поставщику: заведите его на вкладке <Link href="/bar/suppliers" prefetch={false}>«Поставщики»</Link>.</EmptyState>
      : <NewReceipt products={products.value} suppliers={suppliers.value} today={today} />}
  </Page>;
}
