import Link from 'next/link';
import { Suspense } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../../../components/page';
import { LoadError } from '../../../../components/load-error';
import { RefreshButton } from '../../../../components/refresh-button';
import { EmptyState, LoadingState, Panel } from '../../../../components/ui';
import { Icon } from '../../../../components/icon';
import { ApiError, platformApi, type PlatformCeoOverview } from '../../../../lib/api';
import { loadErrorProps } from '../../../../lib/load-error';
import { formatInt } from '../../../../lib/dashboard-format';
import { currentLocale, serverT } from '../../../../i18n/server';
import { CabinetShell, usd } from '../shell';
import { MonthPicker } from '../money/month-picker';
import { tenthsText } from '../growth-parts';

type Row = { id: string; label: string; value: string; tone?: 'danger' | 'success' | undefined };

/**
 * VTOP Overview (ТЗ владельца 30.10.2026 «две категории админок», п. 3): весь бизнес WETOP одним экраном, пять
 * блоков: Выручка, Клиенты, Подписки, Партнёры, Финансы. Только данные компании WETOP (уровень 1), бизнесы клиентов
 * сюда не попадают. Только главному администратору.
 */
export default async function OverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const t = await serverT();
  const q = await searchParams;
  const raw = typeof q['month'] === 'string' ? q['month'] : '';
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : new Date().toISOString().slice(0, 7);
  return (
    <Page width="full" title={t('Обзор WETOP')} actions={<RefreshButton />}>
      <Suspense fallback={<LoadingState label={t('Считаем бизнес WETOP…')} />}>
        <Overview month={month} />
      </Suspense>
    </Page>
  );
}

async function Overview({ month }: { month: string }) {
  const t = await serverT();
  const locale = await currentLocale();
  let v: PlatformCeoOverview;
  try {
    v = await platformApi.ceoOverview(month);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && error.status === 403)
      return (
        <EmptyState icon={<Icon name="shield" width={32} height={32} />} title={t('Раздел главного администратора платформы')} data-testid="cabinet-forbidden">
          {t('Кабинет компании видит только главный администратор.')}
        </EmptyState>
      );
    return <LoadError testId="cabinet-error" {...loadErrorProps(error)} />;
  }
  const r = v.revenue;
  const growth = r.growthTenths === null ? '' : `${r.growthTenths >= 0 ? '+' : '\u2212'}${tenthsText(Math.abs(r.growthTenths))}%`;
  const blocks: Array<{ id: string; title: string; href: string; rows: Row[] }> = [
    {
      id: 'revenue',
      title: t('Выручка'),
      href: `/platform/cabinet/money?month=${month}`,
      rows: [
        { id: 'mrr', label: 'MRR', value: usd(r.mrrCents), tone: 'success' },
        { id: 'arr', label: 'ARR', value: usd(r.arrCents) },
        { id: 'month', label: t('За месяц'), value: usd(r.thisMonthCents) },
        { id: 'last', label: t('Прошлый месяц'), value: usd(r.lastMonthCents) },
        { id: 'ytd', label: t('С начала года'), value: usd(r.ytdCents) },
        { id: 'forecast', label: t('Прогноз месяца'), value: usd(r.forecastCents) },
        { id: 'growth', label: t('Рост к прошлому месяцу'), value: growth, tone: r.growthTenths !== null && r.growthTenths < 0 ? 'danger' : undefined },
      ],
    },
    {
      id: 'clients',
      title: t('Клиенты'),
      href: '/platform/cabinet/clients',
      rows: [
        { id: 'total', label: t('Всего'), value: formatInt(v.clients.total) },
        { id: 'new', label: t('Новые за месяц'), value: formatInt(v.clients.new) },
        { id: 'active', label: t('Платят'), value: formatInt(v.clients.active), tone: 'success' },
        { id: 'trial', label: t('На пробном'), value: formatInt(v.clients.trial) },
        { id: 'churned', label: t('Ушли за месяц'), value: formatInt(v.clients.churned), tone: v.clients.churned ? 'danger' : undefined },
        { id: 'risk', label: t('Под риском'), value: formatInt(v.clients.atRisk), tone: v.clients.atRisk ? 'danger' : undefined },
      ],
    },
    {
      id: 'subscriptions',
      title: t('Подписки'),
      href: '/platform/cabinet/subscriptions',
      rows: [
        { id: 'active', label: t('Действуют'), value: formatInt(v.subscriptions.active) },
        { id: 'monthly', label: t('Месячные'), value: formatInt(v.subscriptions.monthly) },
        { id: 'annual', label: t('Годовые'), value: formatInt(v.subscriptions.annual) },
        ...v.subscriptions.byPlan.map((p) => ({ id: `plan-${p.planId}`, label: p.name, value: formatInt(p.count) })),
      ],
    },
    {
      id: 'partners',
      title: t('Партнёры'),
      href: '/platform/cabinet/partners',
      rows: [
        { id: 'total', label: t('Всего'), value: formatInt(v.partners.total) },
        { id: 'active', label: t('Действуют'), value: formatInt(v.partners.active) },
        { id: 'new', label: t('Новые за месяц'), value: formatInt(v.partners.new) },
        { id: 'clients', label: t('Привели клиентов'), value: formatInt(v.partners.clients) },
        { id: 'revenue', label: t('Принесли денег'), value: usd(v.partners.revenueCents) },
        { id: 'commissions', label: t('Начислено партнёрам'), value: usd(v.partners.commissionsCents) },
      ],
    },
    {
      id: 'finance',
      title: t('Финансы'),
      href: `/platform/cabinet/expenses?month=${month}`,
      rows: [
        { id: 'cash', label: t('Остаток денег'), value: usd(v.finance.cashBalanceCents), tone: v.finance.cashBalanceCents.startsWith('-') ? 'danger' : 'success' },
        { id: 'income', label: t('Доход месяца'), value: usd(v.finance.incomeCents) },
        { id: 'expenses', label: t('Расходы месяца'), value: usd(v.finance.expensesCents) },
        { id: 'profit', label: t('Прибыль месяца'), value: usd(v.finance.profitCents), tone: v.finance.profitCents.startsWith('-') ? 'danger' : undefined },
        { id: 'receivable', label: t('Должны нам'), value: usd(v.finance.receivableCents), tone: v.finance.receivableCents !== '0' ? 'danger' : undefined },
        { id: 'payable', label: t('Должны партнёрам'), value: usd(v.finance.payableCents) },
      ],
    },
  ];
  return (
    <CabinetShell active="overview" t={t} clients={v.clients.total}>
      <div className="cabinet__head">
        <MonthPicker month={month} locale={locale} base="/platform/cabinet/overview" />
      </div>
      <div className="ceo-overview" data-testid="ceo-overview">
        {blocks.map((b) => (
          <Panel key={b.id} data-testid={`ceo-${b.id}`}>
            <h2 className="ceo-overview__title">
              <Link href={b.href} prefetch={false}>
                {b.title}
              </Link>
            </h2>
            <dl className="ceo-overview__rows">
              {b.rows.map((row) => (
                <div key={row.id} data-testid={`ceo-${b.id}-${row.id}`}>
                  <dt>{row.label}</dt>
                  <dd data-tone={row.tone}>{row.value}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        ))}
      </div>
      <p className="muted cabinet__note">
        {t('Остаток денег: все оплаты минус все расходы. Должны нам: просроченные подписки. ARR: MRR за 12 месяцев.')}
      </p>
    </CabinetShell>
  );
}
