import { Suspense } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../../../components/page';
import { LoadError } from '../../../../components/load-error';
import { RefreshButton } from '../../../../components/refresh-button';
import { EmptyState, LoadingState, Panel, Table } from '../../../../components/ui';
import { Icon } from '../../../../components/icon';
import { ApiError, platformApi, type PlatformCountries } from '../../../../lib/api';
import { loadErrorProps } from '../../../../lib/load-error';
import { formatInt } from '../../../../lib/dashboard-format';
import { currentLocale, serverT } from '../../../../i18n/server';
import { KpiStrip } from '../kpi-strip';
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
  const dash = '';
  const known = view.rows.filter((r) => r.country !== null);
  const topIncome = known.find((r) => BigInt(r.incomeCents) > 0n) ?? null;
  const topVisitors = [...known].sort((a, b) => (b.visitors ?? 0) - (a.visitors ?? 0))[0] ?? null;
  const unknown = view.rows.find((r) => r.country === null);
  return (
    <CabinetShell active="countries" t={t}>
      <div className="cabinet__head">
        <MonthPicker month={month} locale={locale} base="/platform/cabinet/countries" />
      </div>
      {/* полоса цифр как «Сайт wetop.ai» (владелец 01.11.2026) */}
      <KpiStrip
        testId="countries-strip"
        items={[
          { id: 'count', label: t('Стран'), value: formatInt(known.length), hint: t('за месяц') },
          {
            id: 'top-income',
            label: t('Больше всего дохода'),
            value: topIncome ? countryName(topIncome.country, locale, t) : t('нет оплат'),
            hint: topIncome ? usd(topIncome.incomeCents) : undefined,
            tone: topIncome ? 'success' : undefined,
          },
          {
            id: 'top-visitors',
            label: t('Больше всего посетителей'),
            value: topVisitors && topVisitors.visitors ? countryName(topVisitors.country, locale, t) : t('нет посетителей'),
            hint: topVisitors && topVisitors.visitors ? formatInt(topVisitors.visitors) : undefined,
          },
          {
            id: 'unknown',
            label: t('Клиенты без страны'),
            value: formatInt(unknown?.paying ?? 0),
            hint: t('встанет при входе'),
            tone: (unknown?.paying ?? 0) > 0 ? 'warning' : undefined,
          },
        ]}
      />
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
                    {r.visitorToClient !== null && r.newClients > 0 && <small className="muted cabinet__sub">{percentText(r.visitorToClient)}</small>}
                  </td>
                  <td className="num">
                    {formatInt(r.firstPayments)}
                    {r.clientToPaid !== null && r.firstPayments > 0 && <small className="muted cabinet__sub">{percentText(r.clientToPaid)}</small>}
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
          {t('Страна клиента: выбранная при регистрации; у заведённых без неё страна адреса первого входа. Посетителя: по адресу визита.')}
        </p>
      </Panel>
    </CabinetShell>
  );
}
