import { Suspense } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { Badge, Button, EmptyState, LoadingState, Panel } from '../../components/ui';
import { branchesApi, ownerBusinessesApi, type OwnerBusinesses } from '../../lib/api';
import { loadErrorProps } from '../../lib/load-error';
import { formatOwnerMoney } from '../../lib/owner-summary';
import { selectBranch } from '../branches/actions';
import { monthLabel } from '../branches/month-picker';
import { MonthPicker } from '../platform/cabinet/money/month-picker';
import '../platform/cabinet/cabinet.css';
import { currentLocale, serverT } from '../../i18n/server';
import { msg, type Translate } from '../../i18n';
import './owner.css';

/**
 * «Кабинет владельца: все бизнесы», вариант C (владелец 30.10.2026: «3»). Итог месяца всех своих бизнесов по валютам,
 * таблица «бизнес, выручка, расходы, прибыль, дела, Перейти», выручка за полгода и где сегодня есть дела. Вячеслав
 * видит WETOP и оба филиала Luxx Aparts; переход в филиал другой организации идёт через `/auth/organization`.
 */
export default async function OwnerPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const [t, q] = await Promise.all([serverT(), searchParams]);
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(q.month ?? '') ? q.month! : new Date().toISOString().slice(0, 7);
  return (
    <Page width="full" title={t('Все бизнесы')}>
      <Suspense fallback={<LoadingState label={t('Считаем бизнесы…')} />}>
        <Businesses month={month} />
      </Suspense>
    </Page>
  );
}

const KIND: Record<'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE', string> = {
  HOSPITALITY: msg('гостиница'),
  BEAUTY: msg('салон'),
  FOOD_SERVICE: msg('ресторан'),
};

async function Businesses({ month }: { month: string }) {
  const [t, locale] = await Promise.all([serverT(), currentLocale()]);
  let view: OwnerBusinesses;
  try {
    view = await ownerBusinessesApi.read(month);
  } catch (error) {
    unstable_rethrow(error);
    return <LoadError testId="owner-error" {...loadErrorProps(error)} />;
  }
  // филиалы своей организации: номер филиала для обычного переключателя (как в шапке)
  const branchIds = await branchesApi
    .list()
    .then((r) => new Map(r.items.map((b) => [b.locationId, b.id])))
    .catch(() => new Map<string, string>());
  const money = (v: string, c: string) => formatOwnerMoney(v, c);
  if (view.rows.length === 0) return <EmptyState title={t('Своих бизнесов пока нет.')} data-testid="owner-empty" />;
  const top = (c: OwnerBusinesses['chart'][number]) => c.revenueMinor.reduce((n, v) => (BigInt(v) > n ? BigInt(v) : n), 0n);
  const busy = view.rows.filter((r) => r.attention > 0);
  return (
    <div className="owner" data-testid="owner-businesses">
      <div className="owner__head">
        <MonthPicker month={month} locale={locale} base="/owner" />
        <span className="muted">
          {t('бизнесов: {b}, филиалов: {f}', { b: view.counts.businesses, f: view.counts.branches })}
        </span>
      </div>
      <section className="owner__totals" aria-label={t('Итог всех бизнесов')}>
        {view.totals.map((x) => {
          const d = BigInt(x.profitMinor) - BigInt(x.previousProfitMinor);
          return (
            <div key={x.currency} className="owner__total" data-testid={`owner-total-${x.currency}`}>
              <h2>{t('Все бизнесы, {currency}', { currency: x.currency })}</h2>
              <dl>
                <div>
                  <dt>{t('Выручка')}</dt>
                  <dd>{money(x.revenueMinor, x.currency)}</dd>
                </div>
                <div>
                  <dt>{t('Расходы')}</dt>
                  <dd>{money(x.expensesMinor, x.currency)}</dd>
                </div>
                <div>
                  <dt>{t('Прибыль')}</dt>
                  <dd className={BigInt(x.profitMinor) < 0n ? 'owner__down' : undefined}>{money(x.profitMinor, x.currency)}</dd>
                </div>
              </dl>
              <small className={d > 0n ? 'owner__up' : d < 0n ? 'owner__down' : 'muted'}>
                {d === 0n
                  ? t('прибыль как в прошлом месяце')
                  : t('прибыль {sign}{sum} к прошлому месяцу', { sign: d > 0n ? '+' : '\u2212', sum: money(String(d < 0n ? -d : d), x.currency) })}
              </small>
            </div>
          );
        })}
      </section>
      <Panel title={t('Бизнесы и филиалы')} className="owner__table-panel">
        <table className="tbl owner__table" data-testid="owner-table">
          <thead>
            <tr>
              <th>{t('Бизнес')}</th>
              <th className="num">{t('Выручка')}</th>
              <th className="num">{t('Расходы')}</th>
              <th className="num">{t('Прибыль')}</th>
              <th>{t('Сегодня')}</th>
              <th aria-label={t('Перейти')} />
            </tr>
          </thead>
          <tbody>
            {view.rows.map((r) => (
              <tr key={r.locationId ?? 'platform'} data-testid="owner-row">
                <td>
                  <b>{r.name}</b>
                  <span className="muted owner__sub">
                    {r.kind === 'PLATFORM'
                      ? t('платформа')
                      : [r.name !== r.businessName ? r.businessName : null, r.vertical ? t(KIND[r.vertical]) : null]
                          .filter(Boolean)
                          .join(', ')}
                  </span>
                </td>
                <td className="num" data-label={t('Выручка')}>{money(r.revenueMinor, r.currency)}</td>
                <td className="num" data-label={t('Расходы')}>{money(r.expensesMinor, r.currency)}</td>
                <td className="num" data-label={t('Прибыль')}>
                  <b className={BigInt(r.profitMinor) < 0n ? 'owner__down' : undefined}>{money(r.profitMinor, r.currency)}</b>
                </td>
                <td data-label={t('Сегодня')}>
                  {r.attention > 0 ? (
                    <Badge tone="warn">{t('дел: {n}', { n: r.attention })}</Badge>
                  ) : (
                    <span className="muted">{t('всё спокойно')}</span>
                  )}
                </td>
                <td className="owner__go">
                  <GoTo row={r} branchId={r.locationId ? branchIds.get(r.locationId) : undefined} t={t} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <div className="owner__pair">
        <Panel title={t('Выручка за 6 месяцев')}>
          {view.chart.map((c) => {
            const max = top(c);
            return (
              <div key={c.currency} className="owner__chart-block" data-testid={`owner-chart-${c.currency}`}>
                <h3>{c.currency}</h3>
                <div className="owner__chart" role="img" aria-label={t('Выручка за 6 месяцев, {currency}', { currency: c.currency })}>
                  {c.revenueMinor.map((v, i) => (
                    <div key={view.months[i]} title={`${monthLabel(view.months[i]!, locale)}: ${money(v, c.currency)}`}>
                      <i
                        style={{ blockSize: `${max === 0n ? 0 : Number((BigInt(v) * 100n) / max)}%` }} /* slop-allow: inline-style высота столбца = выручка месяца */
                      />
                      <em>{monthLabel(view.months[i]!, locale).slice(0, 3)}</em>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </Panel>
        <Panel title={t('Требуют решения сегодня')}>
          {busy.length === 0 ? (
            <p className="muted">{t('Во всех филиалах сегодня всё спокойно.')}</p>
          ) : (
            <ul className="owner__todo" data-testid="owner-todo">
              {busy.map((r) => (
                <li key={r.locationId}>
                  <span>
                    <b>{r.name}</b> {t('дел: {n}', { n: r.attention })}
                  </span>
                  <GoTo row={r} branchId={r.locationId ? branchIds.get(r.locationId) : undefined} t={t} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

/** «Перейти»: WETOP в кабинет компании; филиал своей организации обычным выбором филиала; чужой через смену организации */
function GoTo({ row, branchId, t }: { row: OwnerBusinesses['rows'][number]; branchId: string | undefined; t: Translate }) {
  const label = <span className="sr-only">{t(' в «{name}»', { name: row.name })}</span>;
  if (row.kind === 'PLATFORM')
    return (
      <a className="btn btn--secondary btn--sm" href="/platform/cabinet">
        {t('Кабинет WETOP')}
      </a>
    );
  if (row.current && branchId)
    return (
      <form action={selectBranch}>
        <input type="hidden" name="id" value={branchId} />
        <input type="hidden" name="returnTo" value="/today" />
        <Button type="submit" tone="secondary" size="sm">
          {t('Перейти')}
          {label}
        </Button>
      </form>
    );
  return (
    <form method="post" action="/auth/organization">
      <input type="hidden" name="organizationId" value={row.organizationId ?? ''} />
      <input type="hidden" name="locationId" value={row.locationId ?? ''} />
      <Button type="submit" tone="secondary" size="sm">
        {t('Перейти')}
        {label}
      </Button>
    </form>
  );
}
