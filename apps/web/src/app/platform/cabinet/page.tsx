import Link from 'next/link';
import { Suspense } from 'react';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { RefreshButton } from '../../../components/refresh-button';
import { EmptyState, LoadingState, Panel, PanelTitle } from '../../../components/ui';
import { Icon } from '../../../components/icon';
import { ApiError, platformApi, type PlatformCabinet, type PlatformGrowth } from '../../../lib/api';
import { loadErrorProps } from '../../../lib/load-error';
import { formatInt } from '../../../lib/dashboard-format';
import { currentLocale, serverT } from '../../../i18n/server';
import { unstable_rethrow } from 'next/navigation';
import { monthLabel } from '../../branches/month-picker';
import { CabinetShell, usd } from './shell';
import { MonthPicker } from './money/month-picker';
import { IncomeChart, percentText, RatesChart, SalesFunnelRow, tenthsText } from './growth-parts';

/**
 * Кабинет руководителя WETOP, главная вариант «C» (владелец 01.11.2026: «верхушка где выбор даты, там пустое
 * пространство, а чтобы увидеть нижнюю статистику, нужно свайпать вниз»): месяц и «Обновить» в строке заголовка;
 * сверху два блока: деньги месяца (MRR, оплатившие клиенты, средний чек, сумма оплат) и пробный период; ниже
 * воронка продаж одной строкой из шести шагов с полосками; внизу два графика. Весь экран 1440×900 без прокрутки.
 * Только главному администратору.
 */
export default async function CabinetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await serverT();
  const locale = await currentLocale();
  const q = await searchParams;
  const raw = typeof q['month'] === 'string' ? q['month'] : '';
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : new Date().toISOString().slice(0, 7);
  return (
    <Page
      width="full"
      title={t('Кабинет WETOP')}
      actions={
        <>
          <MonthPicker month={month} locale={locale} base="/platform/cabinet" />
          <RefreshButton />
        </>
      }
    >
      <Suspense fallback={<LoadingState label={t('Считаем клиентов…')} />}>
        <Cabinet month={month} />
      </Suspense>
    </Page>
  );
}

async function Cabinet({ month }: { month: string }) {
  const t = await serverT();
  const locale = await currentLocale();
  let view: PlatformCabinet;
  let growth: PlatformGrowth;
  try {
    [view, growth] = await Promise.all([platformApi.cabinet(), platformApi.growth(month)]);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && error.status === 403)
      return (
        <EmptyState
          icon={<Icon name="shield" width={32} height={32} />}
          title={t('Раздел главного администратора платформы')}
          data-testid="cabinet-forbidden"
        >
          {t('Кабинет компании видит только главный администратор.')}
        </EmptyState>
      );
    return <LoadError testId="cabinet-error" {...loadErrorProps(error)} />;
  }
  const k = growth.kpi;
  const m = growth.money;
  const tr = growth.trial;
  const shortMonth = (mm: string) => monthLabel(mm, locale).split(' ')[0]!.slice(0, 3);
  const diffInt = (now: number, before: number) => (now === before ? '' : `${now > before ? '+' : '\u2212'}${formatInt(Math.abs(now - before))}`);
  const vsPrev = (d: string) => (d ? t('{d} к прошлому месяцу', { d }) : t('как в прошлом месяце'));
  const paidDiff = m ? diffInt(m.paidClients, m.previous.paidClients) : '';
  const money: Array<{ id: string; label: string; value: string; hint: string | undefined; href?: string; tone?: 'up' }> = [
    { id: 'cabinet-mrr', label: t('MRR, в месяц'), value: usd(k.mrrCents), hint: t('подписки, оплаченные на сегодня'), href: '/platform/cabinet/subscriptions' },
    {
      id: 'cabinet-paid-clients',
      label: t('Клиенты, оплатили'),
      value: formatInt(m?.paidClients ?? k.paying),
      hint: m ? vsPrev(paidDiff) : undefined,
      href: '/platform/cabinet/clients',
      ...(paidDiff.startsWith('+') ? { tone: 'up' as const } : {}),
    },
    { id: 'cabinet-avg-check', label: t('Средний чек'), value: usd(m?.avgCheckCents ?? '0'), hint: t('за оплату в месяце') },
    {
      id: 'cabinet-income',
      label: t('Сумма оплат'),
      value: usd(m?.incomeCents ?? '0'),
      hint: t('оплат за месяц: {n}', { n: formatInt(m?.paymentsCount ?? 0) }),
      href: `/platform/cabinet/money?month=${month}`,
    },
  ];
  const activity = tr?.avgActiveDaysTenths ?? null;
  return (
    <CabinetShell active="home" t={t} clients={view.totals.clients} className="cabinet-home-page">
      <div className="cabinet-c">
        <div className="cabinet-c__top">
          <Panel title={t('Деньги за месяц')} className="cabinet-c__money">
            <dl className="cabinet-c__kpis">
              {money.map((x) => (
                <div key={x.id}>
                  <dt className="muted">{x.href ? <Link href={x.href} prefetch={false}>{x.label}</Link> : x.label}</dt>
                  <dd data-testid={x.id}>{x.value}</dd>
                  {x.hint && (
                    <span className="cabinet__sub muted" data-tone={x.tone}>
                      {x.hint}
                    </span>
                  )}
                </div>
              ))}
            </dl>
          </Panel>
          <Panel title={t('Пробный период')} className="cabinet-c__trial">
            <dl className="cabinet-c__rows">
              <div data-testid="cabinet-registrations">
                <dt>{t('Регистрации за месяц')}</dt>
                <dd>
                  <b>{formatInt(tr?.registrations ?? growth.funnel.registrations)}</b>
                  <span className="muted">
                    {t('на пробном {n}, кончается за 3 дня {s}', {
                      n: formatInt(tr?.now ?? k.trial),
                      s: formatInt(tr?.endingSoon ?? k.trialEndingSoon),
                    })}
                  </span>
                </dd>
              </div>
              <div data-testid="cabinet-trial-activity">
                <dt>{t('Активность на пробном')}</dt>
                <dd>
                  <b>{activity === null ? '—' : t('{d} из 7 дней', { d: tenthsText(activity) })}</b>
                  <span className="muted">
                    {activity === null || !tr
                      ? t('пробный ещё ни у кого не кончился')
                      : t('у оплативших {p}, у не оплативших {u}', {
                          p: tr.paidActiveDaysTenths === null ? '—' : tenthsText(tr.paidActiveDaysTenths),
                          u: tr.unpaidActiveDaysTenths === null ? '—' : tenthsText(tr.unpaidActiveDaysTenths),
                        })}
                  </span>
                </dd>
              </div>
              <div data-testid="cabinet-trial-unpaid">
                <dt>{t('После пробного не оплатили')}</dt>
                <dd>
                  <b data-tone={tr && tr.endedUnpaid > 0 ? 'danger' : undefined}>
                    {t('{n} из {m}', { n: formatInt(tr?.endedUnpaid ?? 0), m: formatInt(tr?.ended ?? 0) })}
                  </b>
                  <span className="muted">
                    {tr && tr.ended > 0
                      ? t('{p} пробных, кончившихся в месяце', { p: percentText(Math.floor((tr.endedUnpaid * 1000) / tr.ended)) })
                      : t('пробный ещё ни у кого не кончился')}
                  </span>
                </dd>
              </div>
            </dl>
          </Panel>
        </div>
        <Panel>
          <PanelTitle>
            <span className="cabinet-home__title">
              {t('Воронка продаж')}
              <span className="muted cabinet__sub">{t('% под числом: переход с прошлого шага')}</span>
            </span>
          </PanelTitle>
          <SalesFunnelRow growth={growth} t={t} />
        </Panel>
        <div className="cabinet-c__charts">
          <Panel>
            <PanelTitle>
              <span className="cabinet-home__title">
                {t('Пробный в оплату и продления')}
                <span className="muted cabinet__sub">{t('по месяцам')}</span>
              </span>
            </PanelTitle>
            <RatesChart growth={growth} t={t} monthName={shortMonth} />
          </Panel>
          <Panel title={t('Доход по месяцам')}>
            <IncomeChart growth={growth} t={t} monthName={shortMonth} />
          </Panel>
        </div>
      </div>
    </CabinetShell>
  );
}
