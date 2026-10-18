import Link from 'next/link';
import { requireFeature } from '../../../../lib/vertical-guard';
import { unstable_rethrow } from 'next/navigation';
import { barApi } from '../../../../lib/api';
import { hotelToday } from '../../../../lib/hotel-api';
import { loadBarContext } from '../../load-context';
import { Page } from '../../../../components/page';
import { Alert, EmptyState } from '../../../../components/ui';
import { Icon } from '../../../../components/icon';
import { NewReceipt } from './new-receipt';
import { BarTabs } from '../../tabs';
import { deskShell } from '../../../../lib/desk-shell';
import { barActionAccess } from '../../action-access';
import '../../bar.css';

const settle = <T,>(promise: Promise<T>) => promise.then((value) => ({ ok: true as const, value }), (error: unknown) => { unstable_rethrow(error); return { ok: false as const, error }; });

/**
 * Новый приход (ADR-157): шапка документа, строки и ИИ-скан накладной. Товара нет в справочнике:
 * карточка заводится прямо из строки и создаётся вместе с приходом.
 */
export default async function BarNewReceiptPage() {
  await requireFeature('/bar/receipts/new');
  const [products, suppliers, today, shell] = await Promise.all([
    settle(barApi.products()), settle(barApi.suppliers()), hotelToday(), deskShell(),
  ]);
  // UI-FIX-01: форма прихода пишет склад, нужны право desk и не режим чтения.
  const canMutate = shell.access.unknown !== true && barActionAccess(shell, shell.vertical).receiveStock;
  const failed = [products, suppliers].find((result) => !result.ok);
  if (failed && !failed.ok) throw failed.error;
  if (!products.ok || !suppliers.ok) return null;
  // контекст денежных форм: сервер сверяет объект и валюту (D-CUR); у салона вместо объекта филиал
  const context = await loadBarContext();
  return <Page width="wide" className="bar-subpage" title="Новый приход" subtitle="Счёт-фактура или накладная поставщика: загрузите фото, ИИ заполнит строки, либо внесите руками." crumbs={
    <Link href="/bar/receipts" prefetch={false}>← Приходы</Link>
  }>
    <BarTabs current="receipts" />
    {!canMutate
      ? <Alert boxed>{shell.access.unknown
          ? 'Не удалось проверить права. Повторите загрузку страницы.'
          : shell.readOnly
            ? 'Организация работает в режиме чтения. Приходы доступны для просмотра в журнале.'
            : 'Нет права создавать приходы. Журнал доступен для просмотра.'}</Alert>
      : suppliers.value.filter((supplier) => supplier.active).length === 0
      ? <EmptyState icon={<Icon name="guests" />} title="Сначала добавьте поставщика">Приход привязывается к поставщику: заведите его на вкладке <Link href="/bar/suppliers" prefetch={false}>«Поставщики»</Link>.</EmptyState>
      : <NewReceipt products={products.value} suppliers={suppliers.value} today={today} context={context} />}
  </Page>;
}
