import Link from 'next/link';
import { Suspense } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../../../components/page';
import { LoadError } from '../../../../components/load-error';
import { RefreshButton } from '../../../../components/refresh-button';
import { EmptyState, LoadingState, Panel } from '../../../../components/ui';
import { Icon } from '../../../../components/icon';
import { ApiError, platformApi, type PlatformCeoOverview, type PlatformGrowth } from '../../../../lib/api';
import { loadErrorProps } from '../../../../lib/load-error';
import { formatInt } from '../../../../lib/dashboard-format';
import { currentLocale, serverT } from '../../../../i18n/server';
import { CabinetShell, usd } from '../shell';
import { MonthPicker } from '../money/month-picker';
import { IncomeChart, tenthsText } from '../growth-parts';
import { monthLabel } from '../../../branches/month-picker';

type Tone = 'danger' | 'success' | undefined;
type Row = { id: string; label: string; value: string; tone?: Tone };

/**
 * Обзор WETOP, вариант A (владелец 01.11.2026: «как-то стрёмно всё выглядит, улучши дизайн, сделай удобней»): месяц
 * и «Обновить» в строке заголовка; пять главных цифр сверху (MRR, ARR, доход месяца, прибыль, остаток денег); ниже
 * график выручки по месяцам рядом с блоками «Клиенты» и «Финансы»; внизу «Выручка», «Подписки», «Партнёры». Цифра
 * показана один раз. Только данные компании WETOP (уровень 1). Весь экран 1440×900 без прокрутки. Только главному
 * администратору.
 */
export default async function OverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const t = await serverT();
  const locale = await currentLocale();
  const q = await searchParams;
  const raw = typeof q['month'] === 'string' ? q['month'] : '';
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : new Date().toISOString().slice(0, 7);
  return (
    <Page
      width="full"
      title={t('Обзор WETOP')}
      actions={
        <>
          <MonthPicker month={month} locale={locale} base="/platform/cabinet/overview" />
          <RefreshButton />
        </>
      }
    >
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
  let growth: PlatformGrowth | null;
  try {
    [v, growth] = await Promise.all([
      platformApi.ceoOverview(month),
      // график выручки: тот же ряд «Доход по месяцам», что на главной; без него обзор всё равно открывается
      platformApi.growth(month).catch((e: unknown) => {
        unstable_rethrow(e);
        return null;
      }),
    ]);
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
  const f = v.finance;
  const neg = (c: string) => c.startsWith('-');
  const growthText = r.growthTenths === null ? '—' : `${r.growthTenths >= 0 ? '+' : '\u2212'}${tenthsText(Math.abs(r.growthTenths))}%`;
  const shortMonth = (mm: string) => monthLabel(mm, locale).split(' ')[0]!.slice(0, 3);
  const top: Array<{ id: string; label: string; value: string; hint: string; tone?: Tone }> = [
    { id: 'ceo-revenue-mrr', label: 'MRR', value: usd(r.mrrCents), hint: r.growthTenths === null ? t('подписки на сегодня') : t('{g} к прошлому месяцу', { g: growthText }), tone: 'success' },
    { id: 'ceo-revenue-arr', label: 'ARR', value: usd(r.arrCents), hint: t('MRR за 12 месяцев') },
    { id: 'ceo-revenue-month', label: t('Доход месяца'), value: usd(r.thisMonthCents), hint: t('прогноз {f}', { f: usd(r.forecastCents) }) },
    { id: 'ceo-finance-profit', label: t('Прибыль месяца'), value: usd(f.profitCents), hint: t('расходы {e}', { e: usd(f.expensesCents) }), tone: neg(f.profitCents) ? 'danger' : 'success' },
    { id: 'ceo-finance-cash', label: t('Остаток денег'), value: usd(f.cashBalanceCents), hint: t('оплаты минус расходы'), tone: neg(f.cashBalanceCents) ? 'danger' : undefined },
  ];
  const blocks: Record<string, { title: string; href: string; rows: Row[] }> = {
    clients: {
      title: t('Клиенты'),
      href: '/platform/cabinet/clients',
      rows: [
        { id: 'total', label: t('Всего'), value: formatInt(v.clients.total) },
        { id: 'active', label: t('Платят'), value: formatInt(v.clients.active), tone: 'success' },
        { id: 'trial', label: t('На пробном'), value: formatInt(v.clients.trial) },
        { id: 'new', label: t('Новые за месяц'), value: formatInt(v.clients.new) },
        { id: 'churned', label: t('Ушли за месяц'), value: formatInt(v.clients.churned), tone: v.clients.churned ? 'danger' : undefined },
        { id: 'risk', label: t('Под риском'), value: formatInt(v.clients.atRisk), tone: v.clients.atRisk ? 'danger' : undefined },
      ],
    },
    finance: {
      title: t('Финансы'),
      href: `/platform/cabinet/money?tab=out&month=${month}`,
      rows: [
        { id: 'income', label: t('Доход месяца'), value: usd(f.incomeCents), tone: 'success' },
        { id: 'expenses', label: t('Расходы месяца'), value: usd(f.expensesCents) },
        { id: 'receivable', label: t('Должны нам'), value: usd(f.receivableCents), tone: f.receivableCents !== '0' ? 'danger' : undefined },
        { id: 'payable', label: t('Должны партнёрам'), value: usd(f.payableCents) },
      ],
    },
    revenue: {
      title: t('Выручка'),
      href: `/platform/cabinet/money?month=${month}`,
      rows: [
        { id: 'last', label: t('Прошлый месяц'), value: usd(r.lastMonthCents) },
        { id: 'ytd', label: t('С начала года'), value: usd(r.ytdCents) },
        { id: 'forecast', label: t('Прогноз месяца'), value: usd(r.forecastCents) },
        { id: 'growth', label: t('Рост к прошлому месяцу'), value: growthText, tone: r.growthTenths !== null && r.growthTenths < 0 ? 'danger' : r.growthTenths ? 'success' : undefined },
      ],
    },
    subscriptions: {
      title: t('Подписки'),
      href: '/platform/cabinet/subscriptions',
      rows: [
        { id: 'active', label: t('Действуют'), value: formatInt(v.subscriptions.active) },
        { id: 'monthly', label: t('Месячные'), value: formatInt(v.subscriptions.monthly) },
        { id: 'annual', label: t('Годовые'), value: formatInt(v.subscriptions.annual) },
        ...v.subscriptions.byPlan.slice(0, 3).map((p) => ({ id: `plan-${p.planId}`, label: p.name, value: formatInt(p.count) })),
      ],
    },
    partners: {
      title: t('Партнёры'),
      href: '/platform/cabinet/partners',
      rows: [
        { id: 'active', label: t('Действуют'), value: t('{a} из {n}', { a: formatInt(v.partners.active), n: formatInt(v.partners.total) }) },
        { id: 'new', label: t('Новые за месяц'), value: formatInt(v.partners.new) },
        { id: 'clients', label: t('Привели клиентов'), value: formatInt(v.partners.clients) },
        { id: 'revenue', label: t('Принесли денег'), value: usd(v.partners.revenueCents) },
        { id: 'commissions', label: t('Начислено партнёрам'), value: usd(v.partners.commissionsCents) },
      ],
    },
  };
  const block = (id: keyof typeof blocks) => {
    const b = blocks[id]!;
    return (
      <Panel key={id} data-testid={`ceo-${id}`} className="ceo-a__block">
        <h2 className="ceo-overview__title">
          <Link href={b.href} prefetch={false}>
            {b.title}
            <span className="muted cabinet__sub">{t('подробнее')}</span>
          </Link>
        </h2>
        <dl className="ceo-overview__rows">
          {b.rows.map((row) => (
            <div key={row.id} data-testid={`ceo-${id}-${row.id}`}>
              <dt>{row.label}</dt>
              <dd data-tone={row.tone}>{row.value}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    );
  };
  return (
    <CabinetShell active="overview" t={t} clients={v.clients.total}>
      <div className="ceo-a" data-testid="ceo-overview">
        <dl className="ceo-a__kpis">
          {top.map((k) => (
            <div key={k.id}>
              <dt className="muted">{k.label}</dt>
              <dd data-testid={k.id} data-tone={k.tone}>
                {k.value}
              </dd>
              <span className="cabinet__sub muted">{k.hint}</span>
            </div>
          ))}
        </dl>
        <div className="ceo-a__mid">
          <Panel className="ceo-a__chart">
            <h2 className="ceo-overview__title">
              <Link href={`/platform/cabinet/money?month=${month}`} prefetch={false}>
                {t('Выручка по месяцам')}
                <span className="muted cabinet__sub">{t('подробнее')}</span>
              </Link>
            </h2>
            {growth ? <IncomeChart growth={growth} t={t} monthName={shortMonth} /> : <p className="muted">{t('График пока не загрузился, обновите страницу.')}</p>}
          </Panel>
          {block('clients')}
          {block('finance')}
        </div>
        <div className="ceo-a__bottom">
          {block('revenue')}
          {block('subscriptions')}
          {block('partners')}
        </div>
      </div>
    </CabinetShell>
  );
}
