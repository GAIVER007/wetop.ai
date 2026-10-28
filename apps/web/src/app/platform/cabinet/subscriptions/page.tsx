import { Suspense } from 'react';
import { Page } from '../../../../components/page';
import { EmptyState, LoadingState, Panel, Table } from '../../../../components/ui';
import { serverT } from '../../../../i18n/server';
import { CabinetShell, centsToInput, dayText, usd } from '../shell';
import { PlanForm, SubscriptionForm } from '../money-forms';
import { NotReady, loadMoney } from '../load-money';

/** Подписки клиентов и тарифы компании WETOP (DATA_MODEL §63): цены вводит сам владелец, в долларах */
export default async function SubscriptionsPage() {
  const t = await serverT();
  return (
    <Page width="full" title={t('Подписки')}>
      <Suspense fallback={<LoadingState label={t('Загружаем подписки…')} />}>
        <Subscriptions />
      </Suspense>
    </Page>
  );
}

async function Subscriptions() {
  const t = await serverT();
  const { view, error } = await loadMoney(new Date().toISOString().slice(0, 7), t);
  if (!view)
    return (
      <CabinetShell active="subscriptions" t={t}>
        {error}
      </CabinetShell>
    );
  if (!view.ready)
    return (
      <CabinetShell active="subscriptions" t={t}>
        <NotReady t={t} />
      </CabinetShell>
    );
  const overdue = new Set(view.summary.overdue.map((o) => o.organizationId));
  return (
    <CabinetShell
      active="subscriptions"
      t={t}
      clients={view.clients.length}
      side={
        <Panel title={t('Тарифы')} data-testid="money-plans">
          {view.plans.length === 0 ? (
            <EmptyState title={t('Тарифов пока нет. Добавьте первый.')} />
          ) : (
            <ul className="cabinet__list">
              {view.plans.map((p) => (
                <li key={p.id}>
                  <details className="cabinet__plan">
                    <summary>
                      <b>{p.name}</b> {usd(p.priceCents)}{' '}
                      {p.periodMonths === 12 ? t('в год') : t('в месяц')}
                      {!p.active && <span className="muted"> {t('скрыт')}</span>}
                    </summary>
                    <PlanForm plan={{ ...p, priceInput: centsToInput(p.priceCents) }} />
                  </details>
                </li>
              ))}
            </ul>
          )}
          <PlanForm plan={null} />
        </Panel>
      }
    >
      <Panel title={t('Подписки клиентов')} data-testid="money-subscriptions">
        {view.clients.length === 0 ? (
          <EmptyState title={t('Клиентов пока нет. Они появятся после регистрации на сайте.')} />
        ) : (
          <Table aria-label={t('Подписки клиентов')}>
            <thead>
              <tr>
                <th>{t('Клиент')}</th>
                <th>{t('Сейчас')}</th>
                <th>{t('Изменить')}</th>
              </tr>
            </thead>
            <tbody>
              {view.clients.map((c) => (
                <tr key={c.id}>
                  <td>
                    <b>{c.name}</b>
                  </td>
                  <td>
                    {c.monthlyCents === null ? (
                      <span className="muted">{t('подписки нет')}</span>
                    ) : (
                      <>
                        {usd(c.monthlyCents)} {t('в месяц')}
                        <div
                          className={
                            overdue.has(c.id) ? 'cabinet__sub danger-text' : 'cabinet__sub muted'
                          }
                        >
                          {c.paidUntil
                            ? t('оплачено до {date}', { date: dayText(c.paidUntil) })
                            : t('не оплачено')}
                        </div>
                      </>
                    )}
                  </td>
                  <td>
                    <SubscriptionForm
                      client={{ ...c, monthlyInput: centsToInput(c.monthlyCents) }}
                      plans={view.plans.filter((p) => p.active || p.id === c.planId)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </CabinetShell>
  );
}
