import Link from 'next/link';
import { Suspense } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../../../components/page';
import { LoadError } from '../../../../components/load-error';
import { RefreshButton } from '../../../../components/refresh-button';
import { EmptyState, LoadingState, Panel, Table } from '../../../../components/ui';
import { Icon } from '../../../../components/icon';
import { ApiError, platformApi, type PlatformRnp } from '../../../../lib/api';
import { loadErrorProps } from '../../../../lib/load-error';
import { formatInt } from '../../../../lib/dashboard-format';
import { currentLocale, serverT } from '../../../../i18n/server';
import { CabinetShell, usd } from '../shell';
import { MonthPicker } from '../money/month-picker';
import { percentText } from '../growth-parts';

type Tab = 'sales' | 'partners';

/**
 * РНП, «рука на пульсе» (владелец 30.10.2026, эскиз «РНП в Кабинете WETOP»): полоса итогов периода сверху, вкладки
 * «Лиды и продажи» (каждый день месяца строкой, итог внизу) и «Партнёры» (кто сколько привёл и принёс). Месяц ‹ ›.
 */
export default async function RnpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await serverT();
  const q = await searchParams;
  const raw = typeof q['month'] === 'string' ? q['month'] : '';
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : new Date().toISOString().slice(0, 7);
  const tab: Tab = q['tab'] === 'partners' ? 'partners' : 'sales';
  return (
    <Page width="full" title={t('РНП: рука на пульсе')} actions={<RefreshButton />}>
      <Suspense fallback={<LoadingState label={t('Считаем по дням…')} />}>
        <Rnp month={month} tab={tab} />
      </Suspense>
    </Page>
  );
}

async function Rnp({ month, tab }: { month: string; tab: Tab }) {
  const t = await serverT();
  const locale = await currentLocale();
  let view: PlatformRnp;
  try {
    view = await platformApi.rnp(month);
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
  const k = view.total;
  const p = view.partners.total;
  const href = (next: Tab) => `/platform/cabinet/rnp?month=${month}${next === 'partners' ? '&tab=partners' : ''}`;
  const today = new Date().toISOString().slice(0, 10);
  const pct = (v: number | null) => (v === null ? '' : percentText(v));
  const strip =
    tab === 'sales'
      ? [
          { label: t('Посетители'), value: formatInt(k.visitors), id: 'visitors' },
          { label: t('Заявки'), value: formatInt(k.leads), hint: pct(k.visitorToLead), id: 'leads' },
          { label: t('Регистрации'), value: formatInt(k.registrations), hint: pct(k.leadToRegistration), id: 'registrations' },
          { label: t('Первые оплаты'), value: formatInt(k.firstPayments), hint: pct(k.registrationToPaid), id: 'paid' },
          { label: t('Сумма оплат'), value: usd(k.incomeCents), id: 'income' },
          { label: t('Расходы'), value: usd(k.expensesCents), id: 'expenses' },
          { label: t('Цена регистрации'), value: k.costPerRegistrationCents === null ? '' : usd(k.costPerRegistrationCents), id: 'cpr' },
        ]
      : [
          { label: t('Партнёров'), value: formatInt(p.partners), id: 'partners' },
          { label: t('Активных'), value: formatInt(p.active), id: 'active' },
          { label: t('Регистрации'), value: formatInt(p.registrations), id: 'registrations' },
          { label: t('Первые оплаты'), value: formatInt(p.firstPayments), id: 'paid' },
          { label: t('Принесли денег'), value: usd(p.broughtCents), hint: t('всего {sum}', { sum: usd(p.broughtAllTimeCents) }), id: 'brought' },
          { label: t('Выплачено партнёрам'), value: usd(p.paidCents), hint: t('начислено {sum}', { sum: usd(p.accruedCents) }), id: 'paidout' },
        ];
  return (
    <CabinetShell active="rnp" t={t}>
      <div className="cabinet__head">
        <nav className="glass-tabs" aria-label={t('РНП')}>
          <Link href={href('sales')} aria-current={tab === 'sales' ? 'page' : undefined} prefetch={false} data-testid="rnp-tab-sales">
            {t('Лиды и продажи')}
          </Link>
          <Link href={href('partners')} aria-current={tab === 'partners' ? 'page' : undefined} prefetch={false} data-testid="rnp-tab-partners">
            {t('Партнёры')}
          </Link>
        </nav>
        <MonthPicker month={month} locale={locale} base={tab === 'partners' ? '/platform/cabinet/rnp?tab=partners' : '/platform/cabinet/rnp'} />
      </div>
      {/* плитки «B» (владелец 30.10.2026): одна полоса цифр с разделителями, конверсия рядом с цифрой */}
      <dl className="kpi-strip" data-testid="rnp-strip">
        {strip.map((s) => (
          <div key={s.id} data-testid={`rnp-${s.id}`}>
            <dt>{s.label}</dt>
            <dd>
              <b>{s.value}</b>
              {s.hint && <small>{s.hint}</small>}
            </dd>
          </div>
        ))}
      </dl>
      {tab === 'sales' ? (
        <Panel title={t('По дням')}>
          <Table aria-label={t('РНП по дням')} data-testid="rnp-days" className="cabinet__rnp">
            <thead>
              <tr>
                <th>{t('День')}</th>
                <th className="num">{t('Посетители')}</th>
                <th className="num">{t('Заявки')}</th>
                <th className="num">{t('Регистрации')}</th>
                <th className="num">{t('Первые оплаты')}</th>
                <th className="num">{t('Сумма оплат')}</th>
                <th className="num">{t('Расходы')}</th>
                <th className="num">{t('Посетитель в заявку')}</th>
                <th className="num">{t('Заявка в регистрацию')}</th>
              </tr>
            </thead>
            <tbody>
              {view.days
                .filter((d) => d.day <= today)
                .map((d) => (
                  <tr key={d.day} data-testid="rnp-day">
                    <td>{`${d.day.slice(8, 10)}.${d.day.slice(5, 7)}`}</td>
                    <td className="num">{formatInt(d.visitors)}</td>
                    <td className="num">{formatInt(d.leads)}</td>
                    <td className="num">{formatInt(d.registrations)}</td>
                    <td className="num">{formatInt(d.firstPayments)}</td>
                    <td className="num">{usd(d.incomeCents)}</td>
                    <td className="num">{usd(d.expensesCents)}</td>
                    <td className="num">{d.visitors ? percentText(Math.floor((d.leads * 1000) / d.visitors)) : ''}</td>
                    <td className="num">{d.leads ? percentText(Math.floor((d.registrations * 1000) / d.leads)) : ''}</td>
                  </tr>
                ))}
            </tbody>
            <tfoot>
              <tr data-testid="rnp-total">
                <th>{t('Итого')}</th>
                <td className="num">{formatInt(k.visitors)}</td>
                <td className="num">{formatInt(k.leads)}</td>
                <td className="num">{formatInt(k.registrations)}</td>
                <td className="num">{formatInt(k.firstPayments)}</td>
                <td className="num">{usd(k.incomeCents)}</td>
                <td className="num">{usd(k.expensesCents)}</td>
                <td className="num">{pct(k.visitorToLead)}</td>
                <td className="num">{pct(k.leadToRegistration)}</td>
              </tr>
            </tfoot>
          </Table>
          <p className="muted cabinet__note">
            {t('Посетители и заявки со счётчика wetop.ai, регистрации: новые клиенты, первые оплаты: первая оплата клиента, расходы из «Расходов».')}
          </p>
        </Panel>
      ) : (
        <Panel title={t('Партнёры за месяц')}>
          {view.partners.rows.length === 0 ? (
            <EmptyState title={t('Партнёров пока нет.')}>
              <Link href="/platform/cabinet/partners" prefetch={false}>
                {t('Добавить партнёра')}
              </Link>
            </EmptyState>
          ) : (
            <Table aria-label={t('Партнёры за месяц')} data-testid="rnp-partners" className="cabinet__rnp">
              <thead>
                <tr>
                  <th>{t('Партнёр')}</th>
                  <th className="num">{t('Клиентов')}</th>
                  <th className="num">{t('Регистрации')}</th>
                  <th className="num">{t('Первые оплаты')}</th>
                  <th className="num">{t('Принёс денег')}</th>
                  <th className="num">{t('Начислено')}</th>
                  <th className="num">{t('Выплачено')}</th>
                  <th className="num">{t('Принёс всего')}</th>
                </tr>
              </thead>
              <tbody>
                {view.partners.rows.map((r) => (
                  <tr key={r.id} data-testid="rnp-partner">
                    <td>
                      <b>{r.name}</b>
                      {!r.active && <span className="muted cabinet__sub">{t('не действует')}</span>}
                    </td>
                    <td className="num">{formatInt(r.clients)}</td>
                    <td className="num">{formatInt(r.registrations)}</td>
                    <td className="num">{formatInt(r.firstPayments)}</td>
                    <td className="num">
                      <b>{usd(r.broughtCents)}</b>
                    </td>
                    <td className="num">{usd(r.accruedCents)}</td>
                    <td className="num">{usd(r.paidCents)}</td>
                    <td className="num">{usd(r.broughtAllTimeCents)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr data-testid="rnp-partners-total">
                  <th>{t('Итого')}</th>
                  <td className="num" />
                  <td className="num">{formatInt(p.registrations)}</td>
                  <td className="num">{formatInt(p.firstPayments)}</td>
                  <td className="num">
                    <b>{usd(p.broughtCents)}</b>
                  </td>
                  <td className="num">{usd(p.accruedCents)}</td>
                  <td className="num">{usd(p.paidCents)}</td>
                  <td className="num">{usd(p.broughtAllTimeCents)}</td>
                </tr>
              </tfoot>
            </Table>
          )}
        </Panel>
      )}
    </CabinetShell>
  );
}
