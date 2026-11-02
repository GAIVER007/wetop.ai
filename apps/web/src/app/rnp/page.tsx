import { Suspense } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { RefreshButton } from '../../components/refresh-button';
import { LoadingState, Panel, Table } from '../../components/ui';
import { businessRnpApi, type BusinessRnp } from '../../lib/api';
import { loadErrorProps } from '../../lib/load-error';
import { formatInt } from '../../lib/dashboard-format';
import { formatOwnerMoney } from '../../lib/owner-summary';
import { requireFeature } from '../../lib/vertical-guard';
import { msg } from '../../i18n';
import { currentLocale, serverT } from '../../i18n/server';
import { MonthPicker } from '../platform/cabinet/money/month-picker';
import './rnp.css';

/** Подписи столбцов по направлению: одна таблица для салона, ресторана и гостиницы */
const WORDS = {
  BEAUTY: { bookings: msg('Записи'), visits: msg('Пришли') },
  FOOD_SERVICE: { bookings: msg('Брони столов'), visits: msg('Чеки') },
  HOSPITALITY: { bookings: msg('Новые брони'), visits: msg('Заезды') },
} as const;

/**
 * РНП бизнеса, «рука на пульсе» (владелец 30.10.2026: «рнп должна быть у клиентов тоже и заполняться туда каждый день
 * все данные»), как РНП Кабинета WETOP: полоса итогов месяца, каждый день строкой, итог внизу. Всё из базы филиала,
 * само каждый день: сайт, брони, приходы, деньги, расходы. Месяц ‹ ›.
 */
export default async function RnpPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireFeature('/rnp');
  const t = await serverT();
  const q = await searchParams;
  const raw = typeof q['month'] === 'string' ? q['month'] : '';
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : '';
  return (
    <Page width="full" title={t('РНП: рука на пульсе')} actions={<RefreshButton />}>
      <Suspense fallback={<LoadingState label={t('Считаем по дням…')} />}>
        <Rnp month={month} />
      </Suspense>
    </Page>
  );
}

async function Rnp({ month }: { month: string }) {
  const t = await serverT();
  const locale = await currentLocale();
  let view: BusinessRnp;
  try {
    view = await businessRnpApi.read(month);
  } catch (error) {
    unstable_rethrow(error);
    return <LoadError testId="rnp-error" {...loadErrorProps(error)} />;
  }
  const w = WORDS[view.vertical];
  // салон: записи дня раскладываются без остатка, видно отменённые и ещё не отмеченные (владелец 02.11.2026)
  const split = view.vertical === 'BEAUTY';
  const money = (v: string | null) => (v === null ? '' : formatOwnerMoney(v, view.currency));
  const k = view.total;
  const strip = [
    { id: 'visitors', label: t('Посетители сайта'), value: formatInt(k.visitors) },
    { id: 'leads', label: t('Заявки'), value: formatInt(k.leads), hint: k.visitorToLead === null ? '' : `${k.visitorToLead}%` },
    { id: 'bookings', label: t(w.bookings), value: formatInt(k.bookings) },
    { id: 'visits', label: t(w.visits), value: formatInt(k.visits), hint: k.cameRate === null ? '' : t('пришли {percent}%', { percent: k.cameRate }) },
    { id: 'revenue', label: t('Выручка'), value: money(k.revenueMinor) },
    { id: 'expenses', label: t('Расходы'), value: money(k.expensesMinor) },
    { id: 'profit', label: t('Прибыль'), value: money(k.profitMinor) },
    { id: 'average', label: t('Средний чек'), value: money(k.averageMinor) },
  ];
  return (
    <div className="rnp" data-testid="business-rnp">
      <div className="rnp__head">
        <MonthPicker month={view.month} locale={locale} base="/rnp" />
      </div>
      <dl className="rnp__strip" data-testid="rnp-strip">
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
      <Panel title={t('По дням')}>
        <Table aria-label={t('РНП по дням')} data-testid="rnp-days" className="rnp__table">
          <thead>
            <tr>
              <th>{t('День')}</th>
              <th className="num">{t('Посетители сайта')}</th>
              <th className="num">{t('Заявки')}</th>
              <th className="num">{t(w.bookings)}</th>
              <th className="num">{t(w.visits)}</th>
              <th className="num">{t('Не пришли')}</th>
              {split && <th className="num">{t('Отменены')}</th>}
              {split && <th className="num">{t('Не отмечены')}</th>}
              <th className="num">{t('Выручка')}</th>
              <th className="num">{t('Поступило')}</th>
              <th className="num">{t('Расходы')}</th>
              <th className="num">{t('Прибыль')}</th>
              <th className="num">{t('Средний чек')}</th>
            </tr>
          </thead>
          <tbody>
            {view.days.map((d) => (
              <tr key={d.day} data-testid="rnp-day">
                <td>{`${d.day.slice(8, 10)}.${d.day.slice(5, 7)}`}</td>
                <td className="num">{formatInt(d.visitors)}</td>
                <td className="num">{formatInt(d.leads)}</td>
                <td className="num">{formatInt(d.bookings)}</td>
                <td className="num">{formatInt(d.visits)}</td>
                <td className="num">{formatInt(d.noShows)}</td>
                {split && <td className="num">{formatInt(d.cancelled ?? 0)}</td>}
                {split && <td className="num">{formatInt(d.pending ?? 0)}</td>}
                <td className="num">{money(d.revenueMinor)}</td>
                <td className="num">{money(d.receiptsMinor)}</td>
                <td className="num">{money(d.expensesMinor)}</td>
                <td className="num" data-negative={d.profitMinor.startsWith('-') || undefined}>
                  {money(d.profitMinor)}
                </td>
                <td className="num">{money(d.averageMinor)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr data-testid="rnp-total">
              <th>{t('Итого')}</th>
              <td className="num">{formatInt(k.visitors)}</td>
              <td className="num">{formatInt(k.leads)}</td>
              <td className="num">{formatInt(k.bookings)}</td>
              <td className="num">{formatInt(k.visits)}</td>
              <td className="num">{formatInt(k.noShows)}</td>
              {split && <td className="num">{formatInt(k.cancelled ?? 0)}</td>}
              {split && <td className="num">{formatInt(k.pending ?? 0)}</td>}
              <td className="num">{money(k.revenueMinor)}</td>
              <td className="num">{money(k.receiptsMinor)}</td>
              <td className="num">{money(k.expensesMinor)}</td>
              <td className="num">{money(k.profitMinor)}</td>
              <td className="num">{money(k.averageMinor)}</td>
            </tr>
          </tfoot>
        </Table>
        {split && (
          <p className="muted rnp__note">
            {t('Записи на день: пришли + не пришли + отменены + не отмечены. «Не отмечены»: запись прошла, но в журнале не нажали «Пришёл» или «Не пришёл».')}
          </p>
        )}
        <p className="muted rnp__note">{t('Заполняется само каждый день: сайт, брони, приходы, оплаты и расходы кассы филиала.')}</p>
      </Panel>
    </div>
  );
}
