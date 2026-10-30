import type { ReactNode } from 'react';
import type { BeautyOwnerHome } from '../../lib/api';
import { formatOwnerMoney } from '../../lib/owner-summary';
import { appointmentSourceStatus } from '../../lib/status/source';
import { monthLabel } from '../branches/month-picker';
import { msg, type DeskLocale, type Translate } from '../../i18n';

/**
 * Главная владельца салона, вариант «B» (владелец 30.10.2026: «Вариант б хочу», эскиз owner-B): под шапкой Главной
 * четыре цифры месяца с прошлым, путь клиента с процентами и три цифры о людях, мастера, откуда клиенты, выручка и
 * прибыль по месяцам. Считает API (`GET /beauty/owner-home`), здесь только вид.
 *
 * Три ровные колонки на один экран (владелец 30.10.2026: «четко ровно на 1 экран без лишних свайпов»): путь клиента и
 * источники, мастера и месяцы, дела дня и расходы; последний блок колонки тянется до низа, пустоты под ним нет.
 */
const STEP: Record<BeautyOwnerHome['funnel'][number]['step'], string> = {
  BOOKED: msg('Записались'),
  CAME: msg('Пришли'),
  PAID: msg('Оплатили'),
  RETURNED: msg('Вернулись повторно'),
};

function delta(cur: string | number | null, prev: string | number | null, money: (v: string) => string, t: Translate, lessIsBetter = false) {
  if (cur === null || prev === null) return <span className="muted">{t('нет данных за прошлый месяц')}</span>;
  const d = BigInt(cur) - BigInt(prev);
  if (BigInt(prev) === 0n && BigInt(cur) === 0n) return <span className="muted">{t('как в прошлом месяце')}</span>;
  const text = typeof cur === 'number' ? String(d < 0n ? -d : d) : money(String(d < 0n ? -d : d));
  if (d === 0n) return <span className="muted">{t('как в прошлом месяце')}</span>;
  return (
    <span className={d > 0n !== lessIsBetter ? 'owner-b__up' : 'owner-b__down'}>
      {d > 0n ? '+' : '\u2212'}
      {text} <span className="muted">{t('к прошлому месяцу')}</span>
    </span>
  );
}

export function OwnerHomeB({
  view,
  t,
  locale,
  attention,
  expenses,
}: {
  view: BeautyOwnerHome;
  t: Translate;
  locale: DeskLocale;
  /** «Требуют решения» прежней Главной: дела сегодня справа над мастерами (решение 21.10.2026 сохраняется) */
  attention?: ReactNode;
  /** «Куда уходят деньги» прежней Главной: третий блок нижней строки */
  expenses?: ReactNode;
}) {
  const money = (v: string) => formatOwnerMoney(v, view.currency);
  const k = view.kpi;
  const p = k.previous;
  const top = view.funnel[0]?.count ?? 0;
  const monthTop = view.months.reduce((n, m) => (BigInt(m.revenueMinor) > n ? BigInt(m.revenueMinor) : n), 0n);
  const short = (m: string) => monthLabel(m, locale).split(' ')[0]!.slice(0, 3);
  const h = (v: string) => (monthTop === 0n || BigInt(v) <= 0n ? 0 : Number((BigInt(v) * 100n) / monthTop));
  return (
    <div className="owner-b" data-testid="owner-b">
      <section className="owner-panel owner-b__kpis" aria-label={t('Итоги месяца')}>
        <div data-testid="owner-b-revenue">
          <h2>{t('Выручка')}</h2>
          <strong>{money(k.revenueMinor)}</strong>
          {delta(k.revenueMinor, p.revenueMinor, money, t)}
        </div>
        <div data-testid="owner-b-expenses">
          <h2>
            <a href="/finance">{t('Расходы')}</a>
          </h2>
          <strong>{money(k.expensesMinor)}</strong>
          {delta(k.expensesMinor, p.expensesMinor, money, t, true)}
        </div>
        <div data-testid="owner-b-profit">
          <h2>{t('Прибыль')}</h2>
          <strong data-negative={k.profitMinor.startsWith('-') || undefined}>{money(k.profitMinor)}</strong>
          {delta(k.profitMinor, p.profitMinor, money, t)}
        </div>
        <div data-testid="owner-b-clients">
          <h2>{t('Клиенты, оплатили')}</h2>
          <strong>{k.paidClients}</strong>
          {delta(k.paidClients, p.paidClients, money, t)}
        </div>
        <div data-testid="owner-b-average">
          <h2>{t('Средний чек')}</h2>
          <strong>{k.averageMinor === null ? t('нет визитов') : money(k.averageMinor)}</strong>
          {delta(k.averageMinor, p.averageMinor, money, t)}
        </div>
      </section>
      <div className="owner-b__grid">
        <div className="owner-b__col">
        <section className="owner-panel owner-b__card" data-testid="owner-b-funnel" aria-labelledby="owner-b-funnel-title">
          <div className="owner-panel-heading">
            <h2 id="owner-b-funnel-title">{t('Путь клиента')}</h2>
            <span className="muted">{t('% от прошлого шага')}</span>
          </div>
          <ol className="owner-b__cone">
            {view.funnel.map((f) => (
              <li key={f.step} data-testid={`owner-b-step-${f.step}`}>
                <span className="owner-b__step">{t(STEP[f.step])}</span>
                <span className="owner-b__track" aria-hidden="true">
                  <span
                    className="owner-b__bar"
                    style={{ inlineSize: `${top ? Math.max(4, Math.round((f.count * 100) / top)) : 4}%` }} /* slop-allow: inline-style ширина шага = доля людей */
                  />
                </span>
                <b>{f.count}</b>
                <strong>{f.percent === null ? '' : `${f.percent}%`}</strong>
              </li>
            ))}
          </ol>
          <dl className="owner-b__people">
            <div>
              <dt>{t('Новые клиенты')}</dt>
              <dd data-testid="owner-b-new">{view.clients.new}</dd>
            </div>
            <div>
              <dt>{t('Не пришли')}</dt>
              <dd className={view.clients.noShow ? 'owner-b__down' : undefined}>{view.clients.noShow}</dd>
            </div>
            <div>
              <dt>{t('Давно не были')}</dt>
              <dd>{view.clients.lapsed}</dd>
            </div>
          </dl>
        </section>
        <section className="owner-panel owner-b__card owner-b__grow" data-testid="owner-b-sources" aria-labelledby="owner-b-sources-title">
          <div className="owner-panel-heading">
            <h2 id="owner-b-sources-title">{t('Откуда клиенты')}</h2>
            <span className="muted">{t('оплатившие в месяце')}</span>
          </div>
          {view.sources.length === 0 ? (
            <p className="owner-b__empty">{t('Оплаченных визитов в этом месяце нет')}</p>
          ) : (
            <table className="owner-b__table">
              <thead>
                <tr>
                  <th>{t('Источник')}</th>
                  <th className="num">{t('Клиенты')}</th>
                  <th className="num">{t('Выручка')}</th>
                </tr>
              </thead>
              <tbody>
                {view.sources.map((s) => {
                  const label = appointmentSourceStatus[s.source as keyof typeof appointmentSourceStatus];
                  return (
                    <tr key={s.source}>
                      <td>{label ? (label.proper ? label.label : t(label.label)) : s.source}</td>
                      <td className="num">{s.clients}</td>
                      <td className="num">{money(s.revenueMinor)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
        </div>
        <div className="owner-b__col">
        {/* все мастера одной таблицей (владелец 30.10.2026: «почему не все мастера»), строка в одну линию */}
        <section className="owner-panel owner-b__card owner-b__grow" data-testid="owner-b-masters" aria-labelledby="owner-b-masters-title">
          <div className="owner-panel-heading">
            <h2 id="owner-b-masters-title">{t('Мастера')}</h2>
            <a href="/team">{t('Персонал')}</a>
          </div>
          {view.masters.length === 0 ? (
            <p className="owner-b__empty">{t('В этом месяце выполненных визитов нет')}</p>
          ) : (
            <div className="owner-b__masters-wrap">
              <table className="owner-b__table owner-b__masters">
                <thead>
                  <tr>
                    <th>{t('Мастер')}</th>
                    <th className="num">{t('Визиты')}</th>
                    <th className="num">{t('Постоянные')}</th>
                    <th className="num">{t('Выручка')}</th>
                    <th className="num">{t('Оценка')}</th>
                  </tr>
                </thead>
                <tbody>
                  {view.masters.map((m) => (
                    <tr key={m.employeeId} data-testid="owner-b-master">
                      <td className="owner-b__master-name">{m.name}</td>
                      <td className="num">{m.visits}</td>
                      <td className="num">{m.returning}</td>
                      <td className="num">
                        <b>{money(m.revenueMinor)}</b>
                      </td>
                      <td className="num owner-b__stars">{m.avgTenths === null ? <span className="muted">{t('нет оценок')}</span> : `\u2605 ${(m.avgTenths / 10).toFixed(1).replace('.', ',')}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="owner-panel owner-b__card" data-testid="owner-b-months" aria-labelledby="owner-b-months-title">
          <div className="owner-panel-heading">
            <h2 id="owner-b-months-title">{t('Выручка и прибыль по месяцам')}</h2>
            <span className="owner-b__legend">
              <i className="owner-b__dot" /> {t('выручка')} <i className="owner-b__dot owner-b__dot--profit" /> {t('прибыль')}
            </span>
          </div>
          <div className="owner-b__chart" role="img" aria-label={t('Выручка и прибыль по месяцам')}>
            {view.months.map((m) => (
              <div key={m.month} title={`${monthLabel(m.month, locale)}: ${money(m.revenueMinor)}, ${money(m.profitMinor)}`}>
                <span className="owner-b__pair">
                  <i style={{ blockSize: `${h(m.revenueMinor)}%` }} /* slop-allow: inline-style высота столбца = выручка */ />
                  <i
                    className="owner-b__profit"
                    style={{ blockSize: `${h(m.profitMinor)}%` }} /* slop-allow: inline-style высота столбца = прибыль */
                  />
                </span>
                <em>{short(m.month)}</em>
              </div>
            ))}
          </div>
        </section>
        </div>
        <aside className="owner-b__col" aria-label={t('Решения')}>
          {attention}
          {expenses}
        </aside>
      </div>
    </div>
  );
}
