import { requireFeature } from '../../../lib/vertical-guard';
import { unstable_rethrow } from 'next/navigation';
import { deskShell } from '../../../lib/desk-shell';
import { barActionAccess } from '../action-access';
import { barApi } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import { workspaceTimezone } from '../../../lib/workspace-context';
import { propertyClock } from '../../../lib/property-time';
import { Page } from '../../../components/page';
import { Badge, Table, type BadgeTone } from '../../../components/ui';
import { BarReturnButtons } from '../return-buttons';
import { WriteOffForm } from '../write-off-form';
import { InventoryCountForm } from '../inventory-count-form';
import { SaleForm } from '../sale-form';
import { CatalogDialog } from '../catalog-dialog';
import { BarTabs } from '../tabs';
import { loadBarContext } from '../load-context';
import { MovementFilters } from './movement-filters';
import { movementRows, parseMovementType, parsePeriod, periodRange, type MovementType } from './movements-feed';
import '../bar.css';
import '../../journal-head.css';
import { msg } from '../../../i18n';
import { serverT } from '../../../i18n/server';

const settle = <T,>(promise: Promise<T>) =>
  promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const, error };
    },
  );

const READ_ONLY_NOTE =
  msg('Остаток нельзя менять: режим чтения или нет права. Журналы доступны для просмотра.');

const TYPE_TONE: Record<MovementType, BadgeTone> = {
  sales: 'info',
  returns: 'warn',
  writeoff: 'danger',
  inventory: 'neutral',
  receipts: 'ok',
};

/** Одна строка типа для ленты: «Продажа», «Возврат», «Списание», «Инвентаризация», «Приход» */
const ROW_LABEL: Record<MovementType, string> = {
  sales: msg('Продажа'),
  returns: msg('Возврат'),
  writeoff: msg('Списание'),
  inventory: msg('Инвентаризация'),
  receipts: msg('Приход'),
};

type Search = { type?: string; period?: string; q?: string };

/**
 * «Склад: движение товаров» (ТЗ склада 25.10.2026, пункт E): одна лента всех движений, новые сверху, с отборами
 * период, товар, тип в адресе; «Продажа», «Списать», «Инвентаризация» в шапке открывают окна с прежними формами.
 * Остатка после движения и автора нет в загруженных данных, их колонок нет.
 */
export default async function BarOperationsPage({ searchParams }: { searchParams?: Promise<Search> } = {}) {
  const me = await requireFeature('/bar/operations');
  const t = await serverT();
  const search: Search = (await searchParams) ?? {};
  const [stock, sales, movements, paymentMethods, shell] = await Promise.all([
    settle(barApi.stock()),
    settle(barApi.sales()),
    settle(barApi.movements()),
    settle(barApi.paymentMethods()),
    deskShell(),
  ]);
  // Сохраняем проверку refunds и readOnly из актуального main (ADR-181).
  const rights = barActionAccess(shell, shell.vertical);
  const canReverse = rights.refundFinance;
  const canMutate = rights.operateStock;
  const canSell = rights.sell;
  const failed = [stock, sales, movements].find((result) => !result.ok);
  if (failed && !failed.ok) throw failed.error;
  if (!stock.ok || !sales.ok || !movements.ok) return null;
  // контекст денежных форм: сервер сверяет объект и валюту (D-CUR); у салона вместо объекта филиал
  const context = await loadBarContext();
  const beauty = shell.vertical === 'BEAUTY';
  const clock = propertyClock(await workspaceTimezone());
  const type = parseMovementType(search.type);
  const period = parsePeriod(search.period);
  const query = search.q ?? '';
  const all = movementRows({ sales: sales.value, movements: movements.value });
  const rows = movementRows({ sales: sales.value, movements: movements.value }, type, {
    query,
    ...periodRange(period, clock.today()),
    dayOf: (row) => clock.date(row.createdAt),
  });
  // в unit-тестах охрана подменена и сессии нет: формы получают пустую область восстановления
  const user = me ?? undefined;
  const methods = paymentMethods.ok ? paymentMethods.value.sale : [];
  const actions = (withHash: boolean) => (
    <>
      {canSell && paymentMethods.ok && (
        <CatalogDialog label={t('Продажа')} {...(withHash ? { hash: 'bar-sale' } : {})}>
          <SaleForm
            stock={stock.value}
            context={context}
            methods={methods}
            recoveryScope={[user?.user?.organizationId ?? '', user?.context?.businessId ?? '', user?.context?.locationId ?? '', user?.user?.id ?? '', context.propertyId, context.currency, user?.sessionIssuedAt ?? '']}
            expiresAt={user?.expiresAt ?? ''}
          />
        </CatalogDialog>
      )}
      {canMutate && (
        <CatalogDialog label={t('Списать')} title={t('Списание')} tone="secondary" {...(withHash ? { hash: 'bar-writeoff' } : {})}>
          <WriteOffForm stock={stock.value} context={context} />
        </CatalogDialog>
      )}
      {canMutate && (
        <CatalogDialog label={t('Инвентаризация')} tone="secondary" {...(withHash ? { hash: 'bar-inventory' } : {})}>
          <InventoryCountForm stock={stock.value} context={context} />
        </CatalogDialog>
      )}
    </>
  );
  return (
    <Page
      width="wide"
      className="bar-subpage bar-movements-page"
      title={t('Склад: движение товаров')}
      subtitle={t('Все движения остатка одной лентой: продажи, возвраты, списание, инвентаризация и приходы.')}
      actions={<div className="bar-movement-actions">{actions(true)}</div>}
    >
      <BarTabs current="operations" />
      {!canMutate && <p className="bar-muted">{t(READ_ONLY_NOTE)}</p>}
      <MovementFilters type={type} period={period} query={query} />
      <section
        className="bar-movement-feed"
        aria-label={beauty ? t('Движения остатка склада') : t('Движения остатка бара')}
      >
        {all.length === 0 ? (
          <div className="bar-movement-empty" data-testid="bar-movements-empty">
            <p className="bar-muted">{t('Движений пока нет.')}</p>
            <div className="bar-movement-actions">{actions(false)}</div>
          </div>
        ) : rows.length === 0 ? (
          <p className="bar-muted bar-movement-empty">{t('По отбору движений нет.')}</p>
        ) : (
          <Table density="compact" sticky="header" aria-label={beauty ? t('Лента движений склада') : t('Лента движений бара')}>
            <thead>
              <tr>
                <th>{t('Дата и время')}</th>
                <th>{t('Товар')}</th>
                <th>{t('Тип')}</th>
                <th className="num">{t('Кол-во')}</th>
                <th className="num">{t('Сумма')}</th>
                <th>{t('Причина')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const reversed = row.sale?.status === 'REVERSED';
                return (
                  <tr key={row.id} data-type={row.type}>
                    <td>{clock.full(row.createdAt)}</td>
                    <td>{row.item}</td>
                    <td>
                      <Badge tone={TYPE_TONE[row.type]}>{t(ROW_LABEL[row.type])}</Badge>
                      {reversed && (
                        <>
                          {' '}
                          <Badge tone="neutral">{t('Возврат')}</Badge>
                        </>
                      )}
                    </td>
                    <td className={`num bar-qty bar-qty--${row.direction}`}>{row.quantity}</td>
                    <td className="num">{row.amountMinor === null ? '' : formatMoney(row.amountMinor, context.currency)}</td>
                    <td>{row.note ? t(row.note) : ''}</td>
                    <td>
                      {row.sale && row.sale.status === 'POSTED' && canReverse && (
                        <BarReturnButtons
                          saleId={row.sale.id}
                          context={context}
                          amountText={formatMoney(row.sale.totalRevenue, context.currency)}
                          canRestock={shell.vertical === 'BEAUTY' ? rights.updateStock : true}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </section>
    </Page>
  );
}
