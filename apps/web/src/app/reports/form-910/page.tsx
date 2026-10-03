import Link from 'next/link';
import { halfYearMonths, incomeFor910 } from '@pms/domain';
import { normalizeSearchParams, type SearchParams } from '../../../lib/search-params';
import { hotelToday } from '../../../lib/hotel-api';
import { financeApi } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import { Page } from '../../../components/page';
import { Alert, Table } from '../../../components/ui';
import { METHOD_RU } from '../../finance/labels';
import '../../directory.css';
import '../reports.css';

const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

/**
 * Доход для формы 910 по полугодиям (K7 плана развития, ADR-141): помощь бухгалтеру, а не декларация. Кассовый метод:
 * деньги, поступившие от гостей за месяц, минус возвраты того же месяца; гарантия картой не считается (Q-264).
 * Налог и ставку WETOP не считает. Месяцы читаются тем же отчётом, что «Финансы за период»: цифры сходятся.
 */
export default async function Form910Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = normalizeSearchParams(await searchParams);
  const today = await hotelToday();
  const year = /^\d{4}$/.test(sp.year ?? '') ? Number(sp.year) : Number(today.slice(0, 4));
  const half: 1 | 2 =
    sp.half === '1' || sp.half === '2'
      ? (Number(sp.half) as 1 | 2)
      : today.slice(5, 7) <= '06'
        ? 1
        : 2;
  let months: ReturnType<typeof halfYearMonths> = [];
  let error: string | null = null;
  try {
    months = halfYearMonths(year, half);
  } catch (e) {
    error = (e as Error).message;
  }
  const reports = await Promise.all(
    months.map((m) =>
      financeApi.report(m.from, m.to).then(
        (r) => r,
        () => null,
      ),
    ),
  );
  const failed = reports.some((r) => r === null);
  const currency = reports.find((r) => r)?.currency ?? 'KZT';
  const rows = months.map((m, i) => {
    const r = reports[i];
    return {
      ...m,
      income: r
        ? incomeFor910({
            paymentsByMethod: r.paymentsByMethod,
            refundedMinor: r.refunds.amountMinor,
          })
        : null,
    };
  });
  const total = rows.reduce(
    (s, r) =>
      r.income
        ? {
            received: s.received + r.income.receivedMinor,
            refunded: s.refunded + r.income.refundedMinor,
            income: s.income + r.income.incomeMinor,
          }
        : s,
    { received: 0n, refunded: 0n, income: 0n },
  );
  const byMethod = new Map<string, bigint>();
  for (const r of rows)
    for (const p of r.income?.byMethod ?? [])
      byMethod.set(p.method, (byMethod.get(p.method) ?? 0n) + p.amountMinor);
  const money = (v: bigint) => formatMoney(v.toString(), currency);
  const link = (y: number, h: 1 | 2) => `/reports/form-910?year=${y}&half=${h}`;
  const prev = half === 1 ? link(year - 1, 2) : link(year, 1);
  const next = half === 1 ? link(year, 2) : link(year + 1, 1);
  return (
    <Page
      title="Доход для формы 910"
      subtitle={`${half === 1 ? 'Первое' : 'Второе'} полугодие ${year}: деньги от гостей минус возвраты, по месяцам`}
    >
      <nav className="row row--xs" aria-label="Полугодие">
        <Link href={prev} className="btn btn--secondary btn--sm">
          Предыдущее полугодие
        </Link>
        <Link href={next} className="btn btn--secondary btn--sm">
          Следующее полугодие
        </Link>
      </nav>
      {error && <Alert boxed>{error}</Alert>}
      {failed && (
        <Alert boxed>Часть месяцев не загрузилась: итог неполный, обновите страницу.</Alert>
      )}
      {!error && (
        <Table data-testid="form910-months">
          <thead>
            <tr>
              <th>Месяц</th>
              <th className="num">Поступило</th>
              <th className="num">Возвращено</th>
              <th className="num">Доход</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month} data-testid="form910-month">
                <td>
                  <Link href={`/finance?from=${r.from}&to=${r.to}#operations`}>
                    {MONTHS[Number(r.month.slice(5)) - 1]}
                  </Link>
                </td>
                <td className="num">{r.income ? money(r.income.receivedMinor) : '—'}</td>
                <td className="num">{r.income ? money(r.income.refundedMinor) : '—'}</td>
                <td className="num">{r.income ? money(r.income.incomeMinor) : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">За полугодие</th>
              <td className="num">{money(total.received)}</td>
              <td className="num">{money(total.refunded)}</td>
              <td className="num" data-testid="form910-total">
                <b>{money(total.income)}</b>
              </td>
            </tr>
          </tfoot>
        </Table>
      )}
      {byMethod.size > 0 && (
        <Table plain data-testid="form910-methods">
          <thead>
            <tr>
              <th>Способ оплаты</th>
              <th className="num">Поступило за полугодие</th>
            </tr>
          </thead>
          <tbody>
            {[...byMethod].map(([method, amount]) => (
              <tr key={method}>
                <td>{METHOD_RU[method] ?? method}</td>
                <td className="num">{money(amount)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <p className="hint--lg">
        Это помощь бухгалтеру, а не декларация. Считаются деньги, поступившие от гостей (кассовый
        метод), минус возвраты того же месяца; гарантия картой не считается. Оплаты через каналы
        продаж и поступления кассы мимо гостей бухгалтер учитывает по своим правилам. Ставку налога
        WETOP не применяет.
      </p>
    </Page>
  );
}
