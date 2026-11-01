import Link from 'next/link';
import { Suspense } from 'react';
import { Page } from '../../../../components/page';
import { Badge, EmptyState, LoadingState, Panel, Table, type BadgeTone } from '../../../../components/ui';
import { serverT } from '../../../../i18n/server';
import { msg } from '../../../../i18n';
import { CabinetShell, centsToInput, dayText, usd } from '../shell';
import { PlanForm, SubscriptionForm } from '../money-forms';
import { NotReady, loadMoney } from '../load-money';
import { ClientAccess } from '../client-access';
import { FormDialog } from '../form-dialog';
import { KpiStrip } from '../kpi-strip';
import { formatInt } from '../../../../lib/dashboard-format';
import { platformApi, type PlatformMoney, type PlatformSiteBuilderLocation } from '../../../../lib/api';

type Ready = Extract<PlatformMoney, { ready: true }>;
type Tab = 'plans' | 'clients';

/** Филиалы клиентов с доступом к конструктору сайта; ошибка одного клиента не ломает страницу (пустой список) */
async function accessByClient(ids: string[]): Promise<Map<string, PlatformSiteBuilderLocation[]>> {
  const rows = await Promise.all(
    ids.map((id) =>
      platformApi.siteBuilder(id).then(
        (r) => [id, r.items] as const,
        () => [id, [] as PlatformSiteBuilderLocation[]] as const,
      ),
    ),
  );
  return new Map(rows);
}

/**
 * «Тарифы» (вариант Б, владелец 01.11.2026: «тарифы, а не подписки»): вкладки «Тарифы» и «Клиенты», полоса цифр
 * (платят, без тарифа, просрочены, ожидаем в месяц), клиенты одной строкой: тариф, платит, оплачено до, статус;
 * «Изменить» открывает окно с тарифом клиента и доступами. Те же данные, что раньше (DATA_MODEL §63), адрес прежний.
 */
export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await serverT();
  const q = await searchParams;
  const tab: Tab = q['tab'] === 'plans' ? 'plans' : 'clients';
  return (
    <Page width="full" title={t('Тарифы')}>
      <Suspense fallback={<LoadingState label={t('Загружаем тарифы…')} />}>
        <Plans tab={tab} />
      </Suspense>
    </Page>
  );
}

type Status = 'paid' | 'overdue' | 'unpaid' | 'none';
const STATUS: Record<Status, { label: string; tone: BadgeTone }> = {
  paid: { label: msg('оплачен'), tone: 'ok' },
  overdue: { label: msg('просрочен'), tone: 'danger' },
  unpaid: { label: msg('не оплачено'), tone: 'warn' },
  none: { label: msg('без тарифа'), tone: 'neutral' },
};

function statusOf(c: Ready['clients'][number], overdue: Set<string>): Status {
  if (c.monthlyCents === null) return 'none';
  if (overdue.has(c.id)) return 'overdue';
  return c.paidUntil ? 'paid' : 'unpaid';
}

async function Plans({ tab }: { tab: Tab }) {
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
  const status = new Map(view.clients.map((c) => [c.id, statusOf(c, overdue)]));
  const count = (s: Status) => [...status.values()].filter((x) => x === s).length;
  const planName = new Map(view.plans.map((p) => [p.id, p.name]));
  const onPlan = (id: string) => view.clients.filter((c) => c.planId === id).length;
  // доступы к модулям тарифа (владелец 29.10.2026): филиалы каждого клиента с конструктором сайта
  const access = tab === 'clients' ? await accessByClient(view.clients.map((c) => c.id)) : new Map<string, PlatformSiteBuilderLocation[]>();
  return (
    <CabinetShell active="subscriptions" t={t} clients={view.clients.length}>
      <div className="cabinet__head">
        <nav className="glass-tabs" aria-label={t('Тарифы')}>
          <Link href="/platform/cabinet/subscriptions?tab=plans" aria-current={tab === 'plans' ? 'page' : undefined} prefetch={false} data-testid="plans-tab-plans">
            {t('Тарифы')} <span className="muted">{formatInt(view.plans.length)}</span>
          </Link>
          <Link href="/platform/cabinet/subscriptions" aria-current={tab === 'clients' ? 'page' : undefined} prefetch={false} data-testid="plans-tab-clients">
            {t('Клиенты')} <span className="muted">{formatInt(view.clients.length)}</span>
          </Link>
        </nav>
        <FormDialog label={t('+ Тариф')} title={t('Новый тариф')} testId="plan-add-dialog">
          <PlanForm plan={null} />
        </FormDialog>
      </div>
      <KpiStrip
        testId="plans-strip"
        items={[
          { id: 'paid', label: t('Платят'), value: formatInt(count('paid')), tone: 'success' },
          { id: 'unpaid', label: t('Без оплаты'), value: formatInt(count('unpaid') + count('none')) },
          { id: 'overdue', label: t('Просрочены'), value: formatInt(count('overdue')), tone: count('overdue') ? 'danger' : undefined },
          { id: 'expected', label: t('Ожидаем в месяц'), value: usd(view.summary.expectedMonthlyCents) },
        ]}
      />
      {tab === 'plans' ? (
        <Panel data-testid="money-plans">
          {view.plans.length === 0 ? (
            <EmptyState title={t('Тарифов пока нет. Добавьте первый.')} />
          ) : (
            <Table aria-label={t('Тарифы')} className="cabinet__days">
              <thead>
                <tr>
                  <th>{t('Тариф')}</th>
                  <th className="num">{t('Цена')}</th>
                  <th>{t('Период')}</th>
                  <th className="num">{t('Партнёру')}</th>
                  <th className="num">{t('Клиентов')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {view.plans.map((p) => (
                  <tr key={p.id} data-testid="plan-row">
                    <td>
                      <b>{p.name}</b>
                      {!p.active && <span className="muted cabinet__sub">{t('скрыт')}</span>}
                    </td>
                    <td className="num">{usd(p.priceCents)}</td>
                    <td>{p.periodMonths === 12 ? t('в год') : t('в месяц')}</td>
                    <td className="num">{p.partnerPayoutCents ? t('партнёру {sum}', { sum: usd(p.partnerPayoutCents) }) : ''}</td>
                    <td className="num">{formatInt(onPlan(p.id))}</td>
                    <td className="num">
                      <FormDialog label={t('Изменить')} title={p.name} tone="secondary" testId="plan-edit-dialog">
                        <PlanForm plan={{ ...p, priceInput: centsToInput(p.priceCents), partnerPayoutInput: p.partnerPayoutCents ? centsToInput(p.partnerPayoutCents) : '' }} />
                      </FormDialog>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      ) : (
        <Panel data-testid="money-subscriptions">
          {view.clients.length === 0 ? (
            <EmptyState title={t('Клиентов пока нет. Они появятся после регистрации на сайте.')} />
          ) : (
            <Table aria-label={t('Клиенты на тарифах')} className="cabinet__days">
              <thead>
                <tr>
                  <th>{t('Клиент')}</th>
                  <th>{t('Тариф')}</th>
                  <th className="num">{t('Платит')}</th>
                  <th className="num">{t('Оплачено до')}</th>
                  <th>{t('Статус')}</th>
                  <th>{t('Доступы')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {view.clients.map((c) => {
                  const st = STATUS[status.get(c.id) ?? 'none'];
                  const own = access.get(c.id) ?? [];
                  return (
                    <tr key={c.id} data-testid="plan-client-row">
                      <td>
                        <b>{c.name}</b>
                      </td>
                      <td>{c.planId ? (planName.get(c.planId) ?? '') : <span className="muted">{t('свой')}</span>}</td>
                      <td className="num">{c.monthlyCents === null ? '' : t('{sum} в месяц', { sum: usd(c.monthlyCents) })}</td>
                      <td className="num">{c.paidUntil ? dayText(c.paidUntil) : ''}</td>
                      <td>
                        <Badge tone={st.tone}>{t(st.label)}</Badge>
                      </td>
                      <td className="muted">{own.length ? t('Сайт: {n}', { n: formatInt(own.length) }) : ''}</td>
                      <td className="num">
                        <FormDialog label={t('Изменить')} title={c.name} tone="secondary" testId="plan-client-dialog">
                          <SubscriptionForm
                            client={{ ...c, monthlyInput: centsToInput(c.monthlyCents) }}
                            plans={view.plans.filter((p) => p.active || p.id === c.planId)}
                          />
                          {own.length > 0 && (
                            <div className="cabinet-access-list" data-testid="subscription-access-list">
                              {own.map((l) => (
                                <ClientAccess key={l.id} organizationId={c.id} location={l} />
                              ))}
                            </div>
                          )}
                        </FormDialog>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Panel>
      )}
    </CabinetShell>
  );
}

