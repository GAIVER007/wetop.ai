import Link from 'next/link';
import { Suspense } from 'react';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { RefreshButton } from '../../../components/refresh-button';
import { Badge, EmptyState, LoadingState, Panel, Stat, Stats } from '../../../components/ui';
import { Icon } from '../../../components/icon';
import { ApiError, platformApi, type PlatformCabinet, type PlatformGrowth } from '../../../lib/api';
import { loadErrorProps } from '../../../lib/load-error';
import { formatInt } from '../../../lib/dashboard-format';
import { currentLocale, serverT } from '../../../i18n/server';
import { unstable_rethrow } from 'next/navigation';
import { monthLabel } from '../../branches/month-picker';
import { CabinetShell, usd } from './shell';
import { MonthPicker } from './money/month-picker';
import { GrowthFunnel, IncomeChart, withUsText } from './growth-parts';

/**
 * Кабинет руководителя WETOP (владелец 29.10.2026, вариант «А»; план docs/plans/2026-10-29-owner-cabinet-full.md):
 * 4 главные цифры, путь клиента месяца с конверсиями, доход по месяцам, справа сроки. Месяц стрелками ‹ ›.
 * Только главному администратору.
 */
export default async function CabinetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await serverT();
  const q = await searchParams;
  const raw = typeof q['month'] === 'string' ? q['month'] : '';
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : new Date().toISOString().slice(0, 7);
  return (
    <Page width="full" title={t('Кабинет WETOP')} actions={<RefreshButton />}>
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
  const shortMonth = (m: string) => monthLabel(m, locale).split(' ')[0]!.slice(0, 3);
  return (
    <CabinetShell
      active="home"
      t={t}
      clients={view.totals.clients}
      side={
        <Panel title={t('Сроки')} className="cabinet__deadlines" data-testid="cabinet-deadlines">
          {view.deadlines.length === 0 ? (
            <EmptyState title={t('Сроков нет: все клиенты платят.')} />
          ) : (
            <ul className="cabinet__list">
              {view.deadlines.map((d) => (
                <li key={d.id}>
                  <Link className="cabinet__deadline" href={`/platform?org=${d.id}#organization`} prefetch={false}>
                    <span className="cabinet__deadline-name">{d.name}</span>
                    <Badge tone={d.kind === 'unpaid' || d.daysLeft === 0 ? 'danger' : 'warn'}>
                      {d.kind === 'unpaid'
                        ? t('ждёт оплаты')
                        : d.daysLeft === 0
                          ? t('пробный закончился')
                          : t('пробный, {n} дн.', { n: formatInt(d.daysLeft ?? 0) })}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      }
    >
      <div className="cabinet__head">
        <MonthPicker month={month} locale={locale} base="/platform/cabinet" />
      </div>
      <Stats min={180}>
        <Stat
          label={t('MRR, в месяц')}
          value={usd(k.mrrCents)}
          hint={t('подписки, оплаченные на сегодня')}
          tone="success"
          icon={<Icon name="chart" />}
          testId="cabinet-mrr"
          href="/platform/cabinet/subscriptions"
        />
        <Stat
          label={t('Клиенты')}
          value={formatInt(view.totals.clients)}
          hint={t('платят {paying}, не оплатили {unpaid}', { paying: formatInt(k.paying), unpaid: formatInt(k.unpaid) })}
          icon={<Icon name="guests" />}
          testId="cabinet-clients"
          href="/platform/cabinet/clients"
        />
        <Stat
          label={t('Пробный сейчас')}
          value={formatInt(k.trial)}
          hint={t('кончается за 3 дня: {n}', { n: formatInt(k.trialEndingSoon) })}
          icon={<Icon name="booking" />}
          testId="cabinet-trial"
        />
        <Stat
          label={t('Средний LTV')}
          value={usd(k.avgLtvCents)}
          hint={t('с нами в среднем {n}', { n: withUsText(k.avgDaysWithUs, t) })}
          icon={<Icon name="money" />}
          testId="cabinet-ltv"
        />
      </Stats>

      <Panel title={t('Путь клиента за месяц')}>
        <GrowthFunnel growth={growth} t={t} />
      </Panel>

      <Panel title={t('Доход по месяцам')}>
        <IncomeChart growth={growth} t={t} monthName={shortMonth} />
        <Link className="cabinet__more" href={`/platform/cabinet/money?month=${month}`} prefetch={false}>
          {t('Доход, расходы и прибыль')}
        </Link>
      </Panel>
    </CabinetShell>
  );
}
