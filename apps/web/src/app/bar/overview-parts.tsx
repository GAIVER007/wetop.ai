'use client';
import Link from 'next/link';
import type { BarReceiptRow } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { Badge, Table } from '../../components/ui';
import { Icon } from '../../components/icon';
import { msg } from '../../i18n';
import { useT } from '../../i18n/locale-provider';

const receiptBadge = (receipt: BarReceiptRow) => {
  if (receipt.status === 'DRAFT') return { tone: 'neutral' as const, label: msg('Черновик') };
  if (BigInt(receipt.dueAmount) <= 0n) return { tone: 'ok' as const, label: msg('Оплачен') };
  return BigInt(receipt.paidAmount) > 0n
    ? { tone: 'warn' as const, label: msg('Оплачен частично') }
    : { tone: 'danger' as const, label: msg('Не оплачен') };
};
const dayRu = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}`;

/**
 * Пустой склад одной строкой с двумя кнопками вместо большого блока по центру (владелец 25.10.2026:
 * обзор «Склад: бар» помещается на один экран ПК). Общий для салона, гостиницы и ресторана.
 */
export function OverviewEmpty({ canCreate, canReceive }: { canCreate: boolean; canReceive: boolean }) {
  const t = useT();
  return (
    <div className="panel bar-empty-line" role="status">
      <Icon name="product" width={18} height={18} />
      <span>
        <b>{t('Товаров пока нет')}</b>{' '}
        <span className="bar-muted">{t('Заведите товар вручную или загрузите фото накладной: товары появятся вместе с приходом.')}</span>
      </span>
      {(canCreate || canReceive) && (
        <span className="bar-empty-line__actions">
          {canCreate && (
            <Link className="btn btn--sm" href="/bar/products#new-product" prefetch={false}>
              {t('Добавить товар')}
            </Link>
          )}
          {canReceive && (
            <Link className="btn btn--secondary btn--sm" href="/bar/receipts/new" prefetch={false}>
              {t('Приход по накладной')}
            </Link>
          )}
        </span>
      )}
    </div>
  );
}

/** Последние приходы колонкой справа от остатков (2fr и 1fr на ПК), без раскрывашки. */
export function ReceiptsAside({ receipts, currency }: { receipts: BarReceiptRow[]; currency: string }) {
  const t = useT();
  return (
    <section className="panel bar-receipts-aside" aria-labelledby="bar-receipts-title">
      <header className="bar-bottom-head">
        <h2 id="bar-receipts-title" className="bar-panel-title">
          {t('Приходы от поставщиков')}
        </h2>
        <Link href="/bar/receipts" prefetch={false} className="bar-link">
          {t('Все приходы')} <Icon name="arrow" width={16} height={16} />
        </Link>
      </header>
      {receipts.length === 0 ? (
        <p className="bar-muted bar-one-line">{t('Приходов пока нет')}</p>
      ) : (
        <Table density="compact" aria-label={t('Последние приходы поставщиков')} plain>
          <thead>
            <tr>
              <th>{t('Дата')}</th>
              <th>{t('Поставщик')}</th>
              <th className="num">{t('Сумма')}</th>
              <th>{t('Статус')}</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((receipt) => {
              const badge = receiptBadge(receipt);
              return (
                <tr key={receipt.id}>
                  <td>{dayRu(receipt.receivedDate.slice(0, 10))}</td>
                  <td className="bar-product-name">
                    {receipt.supplier.name}
                    <small>{receipt.documentNumber}</small>
                  </td>
                  <td className="num">{formatMoney(receipt.totalAmount, currency)}</td>
                  <td>
                    <Badge tone={badge.tone}>{t(badge.label)}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </section>
  );
}
