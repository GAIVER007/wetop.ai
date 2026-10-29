import { Suspense } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../../../components/page';
import { LoadError } from '../../../../components/load-error';
import { RefreshButton } from '../../../../components/refresh-button';
import { EmptyState, LoadingState, Panel, Stat, Stats, Table } from '../../../../components/ui';
import { Icon } from '../../../../components/icon';
import { ApiError, platformApi, type PlatformCountries } from '../../../../lib/api';
import { loadErrorProps } from '../../../../lib/load-error';
import { formatInt } from '../../../../lib/dashboard-format';
import { currentLocale, serverT } from '../../../../i18n/server';
import { CabinetShell, usd } from '../shell';
import { MonthPicker } from '../money/month-picker';
import { percentText } from '../growth-parts';
import { countryName, flag } from '../country';

/**
 * «Страны» в кабинете руководителя (владелец 29.10.2026, план docs/plans/2026-10-29-owner-cabinet-countries.md): строка
 * на страну: посетители wetop.ai, новые клиенты, первые оплаты, платят сейчас, доход месяца, MRR, средний LTV и
 * переходы. Страна клиента по телефону регистрации, посетителя по Cloudflare. Сверху больше дохода. Месяц ‹ ›.
 */
export default async function CountriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await serverT();
  const q = await searchParams;
  const raw = typeof q['month'] === 'string' ? q['month'] : '';
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : new Date().toISOString().slice(0, 7);
  return (
    <Page width="full" title={t('Страны')} actions={<RefreshButton />}>
      <Suspense fallback={<LoadingState label={t('Считаем по странам…')} />}>
        <Countries month={month} />
      </Suspense>
    </Page>
  );
}

async function Countries({ month }: { month: string }) {
  const t = await serverT();
  const locale = await currentLocale();
  let view: PlatformCountries;
  try {
    view = await platformApi.countries(month);
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
  const dash = '·';
  const known = view.rows.filter((r) => r.country !== null);
  const topIncome = known.find((r) => BigInt(r.incomeCents) > 0n) ?? null;
  const topVisitors = [...known].sort((a, b) => (b.visitors ?? 0) - (a.visitors ?? 0))[0] ?? null;
  const unknown = view.rows.find((r) => r.country === null);
  return (
    <CabinetShell active="countries" t={t}>
      <div className="cabinet__head">
        <MonthPicker month={month} locale={locale} base="/platform/cabinet/countries" />
      </div>
      <Stats min={200}>
        <Stat label={t('Стран')} value={formatInt(known.length)} hint={t('с посетителями или клиентами')} icon={<Icon name="pin" />} testId="countries-count" />
        <Stat
          label={t('Больше всего дохода')}
          value={topIncome ? countryName(topIncome.country, locale, t) : dash}
          hint={topIncome ? usd(topIncome.incomeCents) : t('оплат в месяце нет')}
          icon={<Icon name="chart" />}
          tone="success"
          testId="countries-top-income"
        />
        <Stat
          label={t('Больше всего посетителей')}
          value={topVisitors && topVisitors.visitors ? countryName(topVisitors.country, locale, t) : dash}
          hint={topVisitors && topVisitors.visitors ? formatInt(topVisitors.visitors) : t('посетителей пока нет')}
          icon={<Icon name="guests" />}
          testId="countries-top-visitors"
        />
        <Stat
          label={t('Клиенты без страны')}
          value={formatInt(unknown?.paying ?? 0)}
          hint={t('платящие, заведены до 10.10')}
          icon={<Icon name="person" />}
          testId="countries-unknown"
        />
      </Stats>
      <Panel title={t('Страны за месяц')}>
        {view.rows.length === 0 ? (
          <EmptyState title={t('Пока нет ни посетителей, ни клиентов.')} />
        ) : (
          <Table aria-label={t('Страны за месяц')} data-testid="countries-table" className="cabinet__countries">
            <thead>
              <tr>
                <th>{t('Страна')}</th>
                <th className="num">{t('Посетители')}</th>
                <th className="num">{t('Новые клиенты')}</th>
                <th className="num">{t('Первая оплата')}</th>
                <th className="num">{t('Платят')}</th>
                <th className="num">{t('Доход')}</th>
                <th className="num">{t('MRR')}</th>
                <th className="num">{t('Средний LTV')}</th>
              </tr>
            </thead>
            <tbody>
              {view.rows.map((r) => (
                <tr key={r.country ?? 'none'} data-testid={`country-${r.country ?? 'none'}`}>
                  <td>
                    {r.country && <span aria-hidden="true">{flag(r.country)} </span>}
                    {countryName(r.country, locale, t)}
                  </td>
                  <td className="num">{r.visitors === null ? dash : formatInt(r.visitors)}</td>
                  <td className="num">
                    {formatInt(r.newClients)}
                    {r.visitorToClient !== null && r.newClients > 0 && <span className="muted"> · {percentText(r.visitorToClient)}</span>}
                  </td>
                  <td className="num">
                    {formatInt(r.firstPayments)}
                    {r.clientToPaid !== null && r.firstPayments > 0 && <span className="muted"> · {percentText(r.clientToPaid)}</span>}
                  </td>
                  <td className="num">{formatInt(r.paying)}</td>
                  <td className="num">
                    <b>{usd(r.incomeCents)}</b>
                  </td>
                  <td className="num">{usd(r.mrrCents)}</td>
                  <td className="num">{usd(r.avgLtvCents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr data-testid="countries-total">
                <th>{t('Итого')}</th>
                <td className="num">{view.total.visitors === null ? dash : formatInt(view.total.visitors)}</td>
                <td className="num">{formatInt(view.total.newClients)}</td>
                <td className="num">{formatInt(view.total.firstPayments)}</td>
                <td className="num">{formatInt(view.total.paying)}</td>
                <td className="num">
                  <b>{usd(view.total.incomeCents)}</b>
                </td>
                <td className="num">{usd(view.total.mrrCents)}</td>
                <td className="num" />
              </tr>
            </tfoot>
          </Table>
        )}
        <p className="muted cabinet__note">
          {t('Страна клиента по телефону при регистрации, посетителя по адресу входа. Процент рядом: переход с прошлого шага.')}
        </p>
      </Panel>
    </CabinetShell>
  );
}
