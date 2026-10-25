import { requireFeature } from '../../../lib/vertical-guard';
import { unstable_rethrow } from 'next/navigation';
import { deskShell } from '../../../lib/desk-shell';
import { barActionAccess } from '../action-access';
import { barApi } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import { workspaceTimezone } from '../../../lib/workspace-context';
import { propertyClock } from '../../../lib/property-time';
import { Tabs } from '../../../components/tabs';
import { Page } from '../../../components/page';
import { Badge, EmptyState, Table } from '../../../components/ui';
import { Icon } from '../../../components/icon';
import { BarReturnButtons } from '../return-buttons';
import { WriteOffForm } from '../write-off-form';
import { InventoryCountForm } from '../inventory-count-form';
import { BarTabs } from '../tabs';
import { loadBarContext } from '../load-context';
import '../bar.css';
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

const MOVEMENT_LABEL: Record<string, string> = {
  RECEIPT: msg('Приход'),
  SALE: msg('Продажа'),
  WRITE_OFF: msg('Списание'),
  SALE_RETURN: msg('Возврат'),
  INVENTORY_ADJUSTMENT: msg('Инвентаризация'),
};

/** Операции бара (ADR-157): списание, инвентаризация, журнал продаж с возвратами и лента движений. */
export default async function BarOperationsPage() {
  await requireFeature('/bar/operations');
  const t = await serverT();
  const [stock, sales, movements, shell] = await Promise.all([
    settle(barApi.stock()),
    settle(barApi.sales()),
    settle(barApi.movements()),
    deskShell(),
  ]);
  // Сохраняем проверку refunds и readOnly из актуального main (ADR-181).
  const rights = barActionAccess(shell, shell.vertical);
  const canReverse = rights.refundFinance;
  const canMutate = rights.operateStock;
  const failed = [stock, sales, movements].find((result) => !result.ok);
  if (failed && !failed.ok) throw failed.error;
  if (!stock.ok || !sales.ok || !movements.ok) return null;
  // контекст денежных форм: сервер сверяет объект и валюту (D-CUR); у салона вместо объекта филиал
  const context = await loadBarContext();
  // раздел меню «Склад» у всех направлений (решение владельца 19.10.2026)
  const beauty = shell.vertical === 'BEAUTY';
  const clock = propertyClock(await workspaceTimezone());
  return (
    <Page
      width="wide"
      className="bar-subpage"
      title={t('Склад: движение товаров')}
      subtitle={t('Списание и инвентаризация, журнал продаж с возвратами, лента движений остатка.')}
    >
      <BarTabs current="operations" />
      {/* внутренние вкладки подчёркнутые, как на «Расходниках», чтобы не путались с разделами склада (аудит 21.10.2026 п.18) */}
      <Tabs
        className="bar-tabs-line"
        label={beauty ? t('Операции склада') : t('Операции бара')}
        panels={[
          {
            id: 'bar-sales',
            label: t('Продажи'),
            content: (
              <>
                {sales.value.length === 0 ? (
                  <EmptyState icon={<Icon name="receipt" />} title={t('Продаж пока нет')}>
                    {t('Первую продажу можно записать на «Обзоре».')}
                  </EmptyState>
                ) : (
                  <Table density="compact" sticky="header" aria-label={beauty ? t('Продажи склада') : t('Продажи бара')}>
                    <thead>
                      <tr>
                        <th>{t('Дата')}</th>
                        <th>{t('Товар')}</th>
                        <th>{t('Выручка')}</th>
                        <th>{t('Себестоимость')}</th>
                        <th>{t('Прибыль')}</th>
                        <th>{t('Статус')}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {sales.value.map((sale) => (
                        <tr key={sale.id}>
                          <td>{clock.full(sale.createdAt)}</td>
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
                              {sale.status === 'POSTED' ? t('Продано') : t('Возврат')}
                            </Badge>
                          </td>
                          <td>
                            {sale.status === 'POSTED' && canReverse && (
                              <BarReturnButtons
                                saleId={sale.id}
                                context={context}
                                amountText={formatMoney(sale.totalRevenue, context.currency)}
                                canRestock={shell.vertical === 'BEAUTY' ? rights.updateStock : true}
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
            label: t('Движения'),
            content: (
              <>
                {movements.value.length === 0 ? (
                  <EmptyState icon={<Icon name="journal" />} title={t('Движений пока нет')}>
                    {t('Лента заполнится с первым приходом или продажей.')}
                  </EmptyState>
                ) : (
                  <Table density="compact" sticky="header" aria-label={beauty ? t('Движения остатка склада') : t('Движения остатка бара')}>
                    <thead>
                      <tr>
                        <th>{t('Время')}</th>
                        <th>{t('Товар')}</th>
                        <th>{t('Тип')}</th>
                        <th>{t('Кол-во')}</th>
                        <th>{t('Себестоимость')}</th>
                        <th>{t('Причина')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.value.map((movement) => (
                        <tr key={movement.id}>
                          <td>{clock.full(movement.createdAt)}</td>
                          <td>{movement.product.name}</td>
                          <td>{t(MOVEMENT_LABEL[movement.kind] ?? movement.kind)}</td>
                          <td>{movement.units}</td>
                          <td>{formatMoney(movement.amountMinor, context.currency)}</td>
                          <td>{movement.note ? t(movement.note) : t('нет')}</td>
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
            label: t('Списание'),
            content: (
              <>
                {canMutate ? (
                  <section className="panel bar-quick-panel">
                    <h3>{t('Списание')}</h3>
                    <p className="bar-muted">
                      {t('Порча, бой, срок или угощение: остаток уменьшится с причиной в ленте.')}
                    </p>
                    <WriteOffForm stock={stock.value} context={context} />
                  </section>
                ) : (
                  <p className="bar-muted">{t(READ_ONLY_NOTE)}</p>
                )}
              </>
            ),
          },
          {
            id: 'bar-inventory',
            label: t('Инвентаризация'),
            content: (
              <>
                {canMutate ? (
                  <section className="panel bar-quick-panel">
                    <h3>{t('Инвентаризация')}</h3>
                    <p className="bar-muted">
                      {t('Пересчёт по факту: недостача запишется движением с причиной.')}
                    </p>
                    <InventoryCountForm stock={stock.value} context={context} />
                  </section>
                ) : (
                  <p className="bar-muted">{t(READ_ONLY_NOTE)}</p>
                )}
              </>
            ),
          },
        ]}
      />
    </Page>
  );
}
