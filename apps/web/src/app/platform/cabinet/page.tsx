import { Suspense } from 'react';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { RefreshButton } from '../../../components/refresh-button';
import { EmptyState, LoadingState, Panel, PanelTitle, Stat, Stats } from '../../../components/ui';
import { Icon } from '../../../components/icon';
import { ApiError, platformApi, type PlatformCabinet, type PlatformGrowth } from '../../../lib/api';
import { loadErrorProps } from '../../../lib/load-error';
import { formatInt } from '../../../lib/dashboard-format';
import { currentLocale, serverT } from '../../../i18n/server';
import { unstable_rethrow } from 'next/navigation';
import { monthLabel } from '../../branches/month-picker';
import { CabinetShell, usd } from './shell';
import { MonthPicker } from './money/month-picker';
import { IncomeChart, percentText, RatesChart, SalesFunnel, tenthsText } from './growth-parts';

/**
 * Кабинет руководителя WETOP, главная вариант «B» (владелец 30.10.2026; план docs/plans/2026-10-29-owner-cabinet-full.md):
 * 4 цифры (MRR, оплатившие клиенты, средний чек, сумма оплат), воронка продаж конусом из шести шагов, справа
 * «пробный в оплату и продления» и доход по месяцам, внизу регистрации, активность на пробном и не оплатившие.
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
  const m = growth.money;
  const tr = growth.trial;
  const shortMonth = (mm: string) => monthLabel(mm, locale).split(' ')[0]!.slice(0, 3);
  const diffInt = (now: number, before: number) => (now === before ? '' : `${now > before ? '+' : '\u2212'}${formatInt(Math.abs(now - before))}`);
  const vsPrev = (d: string) => (d ? t('{d} к прошлому месяцу', { d }) : t('как в прошлом месяце'));
  return (
    <CabinetShell active="home" t={t} clients={view.totals.clients} className="cabinet-home-page">
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
          label={t('Клиенты, оплатили')}
          value={formatInt(m?.paidClients ?? k.paying)}
          hint={m ? vsPrev(diffInt(m.paidClients, m.previous.paidClients)) : undefined}
          icon={<Icon name="guests" />}
          testId="cabinet-paid-clients"
          href="/platform/cabinet/clients"
        />
        <Stat
          label={t('Средний чек')}
          value={usd(m?.avgCheckCents ?? '0')}
          hint={t('за оплату в месяце')}
          icon={<Icon name="money" />}
          testId="cabinet-avg-check"
        />
        <Stat
          label={t('Сумма оплат')}
          value={usd(m?.incomeCents ?? '0')}
          hint={t('оплат за месяц: {n}', { n: formatInt(m?.paymentsCount ?? 0) })}
          icon={<Icon name="money" />}
          testId="cabinet-income"
          href={`/platform/cabinet/money?month=${month}`}
        />
      </Stats>

      <div className="cabinet-home">
        <Panel>
          <PanelTitle>
            <span className="cabinet-home__title">
              {t('Воронка продаж')}
              <span className="muted cabinet__sub">{t('% справа: переход с прошлого шага')}</span>
            </span>
          </PanelTitle>
          <SalesFunnel growth={growth} t={t} />
          <p className="muted cabinet__sub cabinet-home__note">
            {t('Шаг 4: работали в системе 3 дня и больше за пробный. Шаг 5: первая оплата. Шаг 6: продлили после оплаты.')}
          </p>
        </Panel>
        <div className="cabinet-home__side">
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

      <div className="cabinet-home__trial">
        <Panel>
          <div className="cabinet-home__fact" data-testid="cabinet-registrations">
            <span className="muted">{t('Регистрации за месяц')}</span>
            <b>{formatInt(tr?.registrations ?? growth.funnel.registrations)}</b>
            <span>
              {t('сейчас на пробном {n}, кончается за 3 дня {s}', {
                n: formatInt(tr?.now ?? k.trial),
                s: formatInt(tr?.endingSoon ?? k.trialEndingSoon),
              })}
            </span>
          </div>
        </Panel>
        <Panel>
          <div className="cabinet-home__fact" data-testid="cabinet-trial-activity">
            <span className="muted">{t('Активность на пробном')}</span>
            <b>
              {tr?.avgActiveDaysTenths === null || tr?.avgActiveDaysTenths === undefined
                ? '—'
                : t('{d} из 7 дней', { d: tenthsText(tr.avgActiveDaysTenths) })}
            </b>
            {tr?.avgActiveDaysTenths !== null && tr?.avgActiveDaysTenths !== undefined && (
              <span className="cabinet__meter" aria-hidden="true">
                <span
                  style={{ inlineSize: `${Math.min(100, Math.round((tr.avgActiveDaysTenths * 100) / 70))}%` }} /* slop-allow: inline-style ширина полосы из доли дней */
                />
              </span>
            )}
            <span>
              {tr?.avgActiveDaysTenths === null || tr?.avgActiveDaysTenths === undefined
                ? t('в месяце пробный ещё ни у кого не кончился')
                : t('у оплативших {p}, у не оплативших {u}', {
                    p: tr.paidActiveDaysTenths === null ? '—' : tenthsText(tr.paidActiveDaysTenths),
                    u: tr.unpaidActiveDaysTenths === null ? '—' : tenthsText(tr.unpaidActiveDaysTenths),
                  })}
            </span>
          </div>
        </Panel>
        <Panel>
          <div className="cabinet-home__fact" data-testid="cabinet-trial-unpaid">
            <span className="muted">{t('После пробного не оплатили')}</span>
            <b data-tone={tr && tr.endedUnpaid > 0 ? 'danger' : undefined}>
              {t('{n} из {m}', { n: formatInt(tr?.endedUnpaid ?? 0), m: formatInt(tr?.ended ?? 0) })}
            </b>
            <span>
              {tr && tr.ended > 0
                ? t('{p} пробных, кончившихся в месяце', { p: percentText(Math.floor((tr.endedUnpaid * 1000) / tr.ended)) })
                : t('в месяце пробный ещё ни у кого не кончился')}
            </span>
          </div>
        </Panel>
      </div>
    </CabinetShell>
  );
}
