import type { ReactNode } from 'react';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import Link from 'next/link';
import { Icon } from '../../components/icon';
import { hotelToday, reservationStatusWords, validDate } from '../../lib/hotel-api';
import { nightsBetween, pluralRu } from '../../lib/plural';
import { displayDate } from '../../lib/display-date';
import {
  financeApi,
  type PeriodDebts,
  type PeriodOperations,
  type PeriodReport,
} from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { deskShell } from '../../lib/desk-shell';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import {
  Alert,
  Badge,
  Button,
  Field,
  Help,
  SectionTitle,
  Stat,
  StatusBadge,
  Table,
} from '../../components/ui';
import { DateInput } from '../../components/date-field';
import '../directory.css';
import './finance.css';
import { FinanceWorkspace } from './workspace';
import { METHOD_RU, operationKind, operationStatus } from './labels';
import { operationFilter } from './operation-filter';

/** Тот же предел, что у `/finance/report`: год с запасом (волна 4) */
const MAX_REPORT_DAYS = 366;
/** Сколько строк долгов видно сразу; остальные — по «Показать все» */
const DEBTS_SHOWN = 20;
/** Операций сразу и по «Показать все»; больше — в выгрузке CSV (ADR-113, F2) */
const OPS_SHOWN = 20;
const OPS_ALL = 500;

/** Четыре вида начислений всегда в одном порядке: владелец видит всю структуру, а не только ненулевое */
const KINDS: Array<[string, string]> = [
  ['ACCOMMODATION', 'Проживание'],
  ['SERVICE', 'Услуги'],
  ['PENALTY', 'Штрафы'],
  ['ADJUSTMENT', 'Корректировки'],
];

const iso = (d: Date) => d.toISOString().slice(0, 10);
/** Границы месяцев и недели от «сегодня» объекта (С-13): день даёт пояс объекта, дальше — календарная арифметика */
function periods(today: string) {
  const now = new Date(`${today}T00:00:00Z`);
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return {
    today,
    month: { from: iso(new Date(Date.UTC(y, m, 1))), to: iso(new Date(Date.UTC(y, m + 1, 0))) },
    prevMonth: { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: iso(new Date(Date.UTC(y, m, 0))) },
    week: { from: iso(new Date(now.getTime() - 6 * 86400000)), to: iso(now) },
  };
}

const byAmount = <T extends { amountMinor: string }>(xs: T[]) =>
  [...xs].sort((a, b) => {
    const d = BigInt(b.amountMinor) - BigInt(a.amountMinor);
    return d > 0n ? 1 : d < 0n ? -1 : 0;
  });

/**
 * «Финансы за период», срез F1 (ADR-113, план `plans/finance-f1-2026-09-27.md`). Экран отвечает на три вопроса
 * за секунды: сколько начислили, сколько получили, сколько ещё собрать и с кого. Сверху — период одной строкой и
 * четыре итога в ряд; под ними — что требует внимания; дальше — из чего сложились деньги; внизу — брони с
 * остатком, по которым можно работать. Числа итогов — прежние поля `/finance/report`; список долгов —
 * `/finance/debts`. Отказ одного запроса не роняет другой и не выдаётся за нули.
 */
export default async function FinanceReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = normalizeSearchParams(await searchParams);
  const cal = periods(await hotelToday());
  const from = sp.from || cal.month.from;
  const to = sp.to || cal.month.to;
  const dates = validDate(from) && validDate(to) && from <= to;
  // Тот же предел, что в API: иначе страница уходит в общий экран ошибки без дат и без формы (§7.4)
  const days = dates ? nightsBetween(from, to) + 1 : 0;
  const tooLong = dates && days > MAX_REPORT_DAYS;
  const valid = dates && !tooLong;
  const settle = <T,>(p: Promise<T>) =>
    p.then(
      (r) => ({ ok: true as const, r }),
      (e: unknown) => ({ ok: false as const, e }),
    );
  const filter = operationFilter(sp.op, sp.method);
  const opsAll = sp.ops === 'all';
  const [loaded, debtsLoaded, opsLoaded, shell] = await Promise.all([
    valid ? settle(financeApi.report(from, to)) : null,
    valid ? settle(financeApi.debts(from, to)) : null,
    valid
      ? settle(financeApi.operations(from, to, { ...filter, limit: opsAll ? OPS_ALL : OPS_SHOWN }))
      : null,
    deskShell(),
  ]);
  const r = loaded?.ok ? loaded.r : null;
  const loadError = loaded && !loaded.ok ? loaded.e : null;
  const debts = debtsLoaded?.ok ? debtsLoaded.r : null;
  const debtsError = debtsLoaded && !debtsLoaded.ok ? debtsLoaded.e : null;
  const ops = opsLoaded?.ok ? opsLoaded.r : null;
  const opsError = opsLoaded && !opsLoaded.ok ? opsLoaded.e : null;
  const cur = r?.currency ?? debts?.currency ?? '';
  const withYear = from.slice(0, 4) !== to.slice(0, 4);
  const periodText =
    from === to
      ? displayDate(from, 'numeric')
      : `${displayDate(from, withYear ? 'numeric' : 'short')} → ${displayDate(to, withYear ? 'numeric' : 'short')}`;
  const period = `/finance?from=${from}&to=${to}`;
  const preset = (p: { from: string; to: string }) => `/finance?from=${p.from}&to=${p.to}`;
  const isPreset = (p: { from: string; to: string }) => p.from === from && p.to === to;
  // Q-206: «К сбору» — сумма того же списка долгов, куда ведёт плитка: число сверху всегда равно сумме строк
  const due = debts ? BigInt(debts.balanceMinor) : 0n;
  const onlyOverdue = sp.debts === 'overdue';
  /** Ссылка на операции с отбором: плитки, способы в таблице и «Требует внимания» ведут сюда (drill-down, F2) */
  const opsHref = (o: { op?: 'payment' | 'refund'; method?: string; all?: boolean }) => {
    const q = new URLSearchParams({ from, to });
    if (o.op) q.set('op', o.op);
    if (o.method) q.set('method', o.method);
    if (o.all) q.set('ops', 'all');
    return `/finance?${q}#operations`;
  };
  const opParam =
    filter.type === 'PAYMENT' ? 'payment' : filter.type === 'REFUND' ? 'refund' : undefined;
  const exportQuery = new URLSearchParams({ from, to });
  if (opParam) exportQuery.set('op', opParam);
  if (filter.method) exportQuery.set('method', filter.method);
  return (
    <Page
      title="Финансы за период"
      subtitle={
        valid ? (
          <span data-testid="finance-period">
            {periodText}, {pluralRu(days, ['день', 'дня', 'дней'])}
          </span>
        ) : undefined
      }
      // Оплату принимают на счёте брони; отсюда можно только пойти её искать (§7.3)
      actions={
        <Link href="/reservations" className="btn">
          <Icon name="search" />
          Найти бронь для оплаты
        </Link>
      }
    >
      <section className="finance-controls" aria-label="Период">
        <form method="get" className="finance-toolbar" data-testid="period-form">
          <Field inline label="С">
            <DateInput
              key={`from-${from}`}
              name="from"
              defaultValue={from}
              aria-label="Период: с"
            />
          </Field>
          <Field inline label="По">
            <DateInput
              key={`to-${to}`}
              name="to"
              rangeFromName="from"
              defaultValue={to}
              aria-label="Период: по"
            />
          </Field>
          {/* Готовые отрезки — ссылками: период виден в адресе и в подзаголовке */}
          <nav className="directory-filters finance-presets" aria-label="Готовые периоды">
            {(
              [
                ['Сегодня', { from: cal.today, to: cal.today }],
                ['7 дней', cal.week],
                ['Этот месяц', cal.month],
                ['Прошлый месяц', cal.prevMonth],
              ] as const
            ).map(([label, p]) => (
              <Link
                key={label}
                href={preset(p)}
                className={isPreset(p) ? 'is-active' : ''}
                aria-current={isPreset(p) ? 'page' : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>
          <Button tone="secondary">Показать</Button>
        </form>
        <p className="finance-note">
          Начисления — по дате услуги, оплаты и возвраты — по дате операции.
        </p>
      </section>

      {tooLong && (
        <Alert boxed>
          Период отчёта — не больше года ({MAX_REPORT_DAYS} дней) за один запрос. Укоротите период:
          за год и дольше это уже выгрузка, а не экран.
        </Alert>
      )}
      {!dates && (
        <Alert boxed>Проверьте даты: окончание периода должно быть не раньше начала.</Alert>
      )}
      {loadError !== null && <LoadError testId="finance-error" {...loadErrorProps(loadError)} />}

      {r && (
        <section className="finance-kpis" aria-label="Итоги периода" data-testid="finance-kpis">
          {/* Каждая плитка ведёт к строкам, из которых сложилось число (drill-down, ТЗ F2) */}
          <a href={`${period}#charges`} className="finance-kpi-link" data-testid="kpi-charged">
            <Stat
              label="Начислено"
              value={formatMoney(r.chargedMinor, cur)}
              testId="charged"
              hint="проживание, услуги, штрафы"
            />
          </a>
          <a href={opsHref({ op: 'payment' })} className="finance-kpi-link" data-testid="kpi-paid">
            <Stat
              label="Оплачено"
              value={formatMoney(r.paidMinor, cur)}
              testId="paid"
              hint="всеми способами оплаты"
            />
          </a>
          <a
            href={opsHref({ op: 'refund' })}
            className="finance-kpi-link"
            data-testid="kpi-refunded"
          >
            <Stat
              label="Возвращено"
              value={formatMoney(r.refundedMinor, cur)}
              testId="refunded"
              hint={
                r.refunds.count
                  ? `${pluralRu(r.refunds.count, ['возврат', 'возврата', 'возвратов'])} за период`
                  : 'возвратов за период не было'
              }
            />
          </a>
          <a
            href={`${period}#debts`}
            className={due > 0n ? 'finance-kpi-link finance-kpi-link--due' : 'finance-kpi-link'}
            data-testid="kpi-due"
          >
            <Stat
              label="К сбору"
              value={debts ? formatMoney(debts.balanceMinor, cur) : '—'}
              testId="balance"
              tone={due > 0n ? 'warn' : undefined}
              hint={
                debtsError !== null ? 'список долгов не загрузился' : 'остаток по броням периода'
              }
            />
          </a>
        </section>
      )}

      {opsError !== null && (
        <Alert boxed>
          Операции не загрузились. <a href={`${period}#operations`}>Открыть детали ошибки</a>
        </Alert>
      )}
      <FinanceWorkspace
        initialView={
          sp.op || sp.method || sp.ops ? 'operations' : sp.debts || sp.more ? 'debts' : 'overview'
        }
        overview={
          <>
            {valid && (r || debts) && (
              <Attention
                report={r}
                debts={debts}
                debtsFailed={debtsError !== null}
                period={period}
                refundsHref={opsHref({ op: 'refund' })}
              />
            )}

            {r && (
              <div className="finance-structure">
                <section className="finance-block" id="charges" data-testid="finance-charges">
                  <SectionTitle first>По видам начислений</SectionTitle>
                  <MoneyTable
                    testId="charges-table"
                    head={['Вид', 'Штук', 'Сумма']}
                    cur={cur}
                    rows={KINDS.map(([kind, label]) => {
                      const x = r.chargesByKind.find((c) => c.kind === kind);
                      return { label, count: x?.count ?? 0, amountMinor: x?.amountMinor ?? '0' };
                    })}
                    total={r.chargedMinor}
                  />
                  <details className="finance-category-details">
                    <summary>Проживание по категориям</summary>
                    <MoneyTable
                      testId="category-table"
                      head={['Категория', 'Проживаний', 'Сумма']}
                      cur={cur}
                      empty="Начислений за проживание за период нет"
                      rows={byAmount(r.accommodationByCategory).map((x) => ({
                        label: x.category,
                        count: x.count,
                        amountMinor: x.amountMinor,
                      }))}
                    />
                  </details>
                </section>
                <section className="finance-block" data-testid="finance-money">
                  <SectionTitle first>Оплаты по способам</SectionTitle>
                  <MoneyTable
                    testId="payments-table"
                    head={['Способ', 'Операций', 'Сумма']}
                    cur={cur}
                    empty="Оплат за период нет"
                    rows={byAmount(r.paymentsByMethod).map((x) => ({
                      label: METHOD_RU[x.method] ?? x.method,
                      count: x.count,
                      amountMinor: x.amountMinor,
                      href: opsHref({ op: 'payment', method: x.method }),
                    }))}
                    total={r.paymentsByMethod.length ? r.paidMinor : undefined}
                  />
                </section>
              </div>
            )}
          </>
        }
        debts={
          <>
            {valid && (
              <section
                className="finance-block finance-debts"
                id="debts"
                aria-labelledby="debts-title"
                data-testid="finance-debts"
              >
                <div className="finance-debts__head">
                  <SectionTitle first id="debts-title">
                    Брони с остатком к сбору
                  </SectionTitle>
                  {debts && debts.count > 0 && (
                    <nav className="directory-filters finance-chips" aria-label="Отбор долгов">
                      <Link
                        href={`${period}#debts`}
                        className={onlyOverdue ? '' : 'is-active'}
                        aria-current={onlyOverdue ? undefined : 'page'}
                      >
                        Все<span className="finance-chips__count">{debts.count}</span>
                      </Link>
                      <Link
                        href={`${period}&debts=overdue#debts`}
                        className={onlyOverdue ? 'is-active' : ''}
                        aria-current={onlyOverdue ? 'page' : undefined}
                      >
                        Просрочено
                        <span className="finance-chips__count">{debts.overdue.count}</span>
                      </Link>
                    </nav>
                  )}
                </div>
                {debtsError !== null && (
                  <LoadError testId="debts-error" {...loadErrorProps(debtsError)} />
                )}
                {debts && (
                  <DebtList
                    debts={debts}
                    onlyOverdue={onlyOverdue}
                    showAll={sp.more === '1'}
                    period={period}
                    canPay={!shell.readOnly}
                  />
                )}
              </section>
            )}
          </>
        }
        operations={
          <>
            {valid && (
              <section
                className="finance-block finance-ops"
                id="operations"
                aria-labelledby="operations-title"
                data-testid="finance-operations"
              >
                <div className="finance-debts__head">
                  <SectionTitle first id="operations-title">
                    Оплаты и возвраты
                  </SectionTitle>
                  {/* Файл уходит из системы: без имён гостей, бронь — номером (ADR-113, F2) */}
                  <a
                    href={`/finance/export?${exportQuery}`}
                    className="btn btn--secondary btn--sm"
                    data-testid="ops-export"
                    download
                  >
                    <Icon name="down" />
                    Скачать CSV
                  </a>
                </div>
                {opsError !== null && (
                  <LoadError testId="ops-error" {...loadErrorProps(opsError)} />
                )}
                {ops && (
                  <Operations
                    ops={ops}
                    type={filter.type}
                    method={filter.method}
                    all={opsAll}
                    opsHref={opsHref}
                    opParam={opParam}
                  />
                )}
              </section>
            )}
          </>
        }
      />

      <Help title="Как считаются суммы">
        <p>
          Оплаты — по дате оплаты, возвраты — по дате возврата, время — по часам объекта.
          Аннулированная оплата остаётся в списке со своим статусом, но в «Оплачено» не входит.
        </p>
        <p>
          «К сбору» — полный текущий остаток по броням, у которых есть начисления за период, как в
          карточке брони. Это та же сумма, что в списке «Брони с остатком к сбору».
        </p>
        <p>
          «Просрочено» — остаток не оплачен, а время выезда по часам объекта уже прошло или гость
          уже выехал. У отменённых броней и незаездов срока нет: их остаток — просто к сбору.
        </p>
        <p>У броней из внешних каналов проверьте предоплату площадки перед взысканием остатка.</p>
      </Help>
    </Page>
  );
}

/**
 * «Требует внимания»: только то, что можно посчитать по данным, и со ссылкой туда, где с этим работают.
 * «Просроченный долг» — остаток, у которого время выезда по часам объекта прошло (Q-207). «Наличных на проверку»
 * нет: у наличных нет отметки проверки, до отдельного решения о кассе строки не будет. Возвраты — справкой
 * со ссылкой на их список (F2).
 */
function Attention({
  report,
  debts,
  debtsFailed,
  period,
  refundsHref,
}: {
  report: PeriodReport | null;
  debts: PeriodDebts | null;
  debtsFailed: boolean;
  period: string;
  refundsHref: string;
}) {
  const cur = debts?.currency ?? report?.currency ?? '';
  const items: Array<{ key: string; tone: 'danger' | 'warn' | 'info'; body: ReactNode }> = [];
  if (debts && debts.count > 0)
    items.push({
      key: 'due',
      tone: 'warn',
      body: (
        <Link href={`${period}#debts`}>
          <strong>{formatMoney(debts.balanceMinor, cur)} к сбору</strong> —{' '}
          {pluralRu(debts.count, ['бронь', 'брони', 'броней'])}
        </Link>
      ),
    });
  if (debts && debts.overdue.count > 0)
    items.push({
      key: 'overdue',
      tone: 'danger',
      body: (
        <Link href={`${period}&debts=overdue#debts`}>
          <strong>
            {pluralRu(debts.overdue.count, ['бронь', 'брони', 'броней'])} с просроченным долгом
          </strong>{' '}
          — {formatMoney(debts.overdue.balanceMinor, cur)}, время выезда прошло
        </Link>
      ),
    });
  if (debtsFailed)
    items.push({
      key: 'failed',
      tone: 'warn',
      body: <span>Список долгов по броням не загрузился — долги ниже не проверены</span>,
    });
  if (report && report.refunds.count > 0)
    items.push({
      key: 'refunds',
      tone: 'info',
      body: (
        <Link href={refundsHref}>
          {pluralRu(report.refunds.count, ['возврат', 'возврата', 'возвратов'])} за период на{' '}
          {formatMoney(report.refunds.amountMinor, cur)}
        </Link>
      ),
    });
  return (
    <section
      className="finance-attention"
      aria-labelledby="finance-attention-title"
      data-testid="finance-attention"
    >
      <h2 id="finance-attention-title" className="finance-attention__title">
        Требует внимания
      </h2>
      {items.length === 0 ? (
        <p className="finance-attention__empty">
          <Icon name="check" />
          За период проблем не найдено
        </p>
      ) : (
        <ul className="finance-attention__list">
          {items.map((x) => (
            <li key={x.key} data-tone={x.tone} data-testid={`attention-${x.key}`}>
              <Icon name={x.tone === 'info' ? 'receipt' : 'money'} />
              {x.body}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DebtList({
  debts,
  onlyOverdue,
  showAll,
  period,
  canPay,
}: {
  debts: PeriodDebts;
  onlyOverdue: boolean;
  showAll: boolean;
  period: string;
  canPay: boolean;
}) {
  const cur = debts.currency;
  const rows = onlyOverdue ? debts.rows.filter((x) => x.overdue) : debts.rows;
  const shown = showAll ? rows : rows.slice(0, DEBTS_SHOWN);
  const total = onlyOverdue ? debts.overdue : debts;
  if (debts.count === 0)
    return (
      <p className="finance-debts__empty" data-testid="debts-empty">
        <Icon name="check" />
        Все брони с начислениями за период оплачены.
      </p>
    );
  return (
    <>
      <p className="finance-debts__meta" data-testid="debts-meta">
        {pluralRu(total.count, ['бронь', 'брони', 'броней'])}
        {onlyOverdue ? ' с просроченным долгом' : ''}, остаток{' '}
        <strong>{formatMoney(total.balanceMinor, cur)}</strong>. Остаток — по всему счёту брони, как
        в карточке; «Оплачено» — за вычетом возвратов.
      </p>
      {rows.length === 0 ? (
        <p className="finance-debts__empty">Просроченных долгов за период нет.</p>
      ) : (
        <Table size="sm" className="finance-debts__table" data-testid="debts-table">
          <thead>
            <tr>
              <th>Бронь</th>
              <th>Гость</th>
              <th>Проживание</th>
              <th className="num">Начислено</th>
              <th className="num">Оплачено</th>
              <th className="num">Остаток</th>
              <th>Статус</th>
              <th>
                <span className="sr-only">Действия</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((x) => {
              const card = `/reservations/${encodeURIComponent(x.confirmationNumber)}`;
              const nights = nightsBetween(x.arrivalDate, x.departureDate);
              return (
                <tr key={x.confirmationNumber} data-testid="debt-row">
                  <td>
                    <Link href={card} className="booking-number">
                      {x.confirmationNumber}
                    </Link>
                  </td>
                  <td>{x.guestLabel || <span className="muted">—</span>}</td>
                  <td className="finance-debts__stay">
                    <time dateTime={x.arrivalDate}>{displayDate(x.arrivalDate)}</time> →{' '}
                    <time dateTime={x.departureDate}>{displayDate(x.departureDate)}</time>
                    {nights > 0 && <small>{pluralRu(nights, ['ночь', 'ночи', 'ночей'])}</small>}
                  </td>
                  <td className="num">{formatMoney(x.chargedMinor, cur)}</td>
                  <td className="num">
                    {formatMoney(BigInt(x.paidMinor) - BigInt(x.refundedMinor), cur)}
                  </td>
                  <td className="num">
                    <strong data-testid="debt-balance">{formatMoney(x.balanceMinor, cur)}</strong>
                    {x.overdue && (
                      <small className="finance-debts__overdue" data-testid="debt-overdue">
                        просрочено
                      </small>
                    )}
                  </td>
                  <td>
                    <StatusBadge
                      status={x.status}
                      label={reservationStatusWords[x.status] || x.status}
                    />
                  </td>
                  <td className="finance-debts__actions">
                    {canPay && (
                      <Link href={`${card}#booking-finance`} className="btn btn--secondary btn--sm">
                        Принять оплату
                      </Link>
                    )}
                    <Link href={card} className="btn btn--ghost btn--sm">
                      Открыть
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      {shown.length < rows.length && (
        <Link
          href={`${period}${onlyOverdue ? '&debts=overdue' : ''}&more=1#debts`}
          className="finance-debts__more"
          data-testid="debts-more"
        >
          Показать все {rows.length}
        </Link>
      )}
      {debts.truncated && showAll && (
        <p className="finance-debts__note">
          Показаны первые {debts.rows.length} из {debts.count}. Укоротите период, чтобы увидеть
          остальные.
        </p>
      )}
    </>
  );
}

/**
 * «Оплаты и возвраты» (ADR-113, F2): отбор по типу и способу ссылками, строка итога по отбору, таблица новыми
 * первыми. Возврат — с минусом (DESIGN.md §14), аннулированная оплата — приглушена и в суммы не входит.
 */
function Operations({
  ops,
  type,
  method,
  all,
  opsHref,
  opParam,
}: {
  ops: PeriodOperations;
  type: 'PAYMENT' | 'REFUND' | undefined;
  method: string | undefined;
  all: boolean;
  opsHref: (o: { op?: 'payment' | 'refund'; method?: string; all?: boolean }) => string;
  opParam: 'payment' | 'refund' | undefined;
}) {
  const cur = ops.currency;
  const types: Array<[string, 'payment' | 'refund' | undefined]> = [
    ['Все', undefined],
    ['Оплаты', 'payment'],
    ['Возвраты', 'refund'],
  ];
  const filtered = type !== undefined || method !== undefined;
  return (
    <>
      <div className="finance-ops__filters">
        <nav className="directory-filters finance-chips" aria-label="Тип операций">
          {types.map(([label, op]) => (
            <Link
              key={label}
              href={opsHref({ ...(op ? { op } : {}), ...(method ? { method } : {}) })}
              className={opParam === op ? 'is-active' : ''}
              aria-current={opParam === op ? 'page' : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        {ops.methods.length > 0 && (
          <nav className="directory-filters finance-chips" aria-label="Способ оплаты">
            <Link
              href={opsHref(opParam ? { op: opParam } : {})}
              className={method ? '' : 'is-active'}
              aria-current={method ? undefined : 'page'}
            >
              Все способы
            </Link>
            {ops.methods.map((m) => (
              <Link
                key={m.method}
                href={opsHref({ ...(opParam ? { op: opParam } : {}), method: m.method })}
                className={method === m.method ? 'is-active' : ''}
                aria-current={method === m.method ? 'page' : undefined}
              >
                {METHOD_RU[m.method] ?? m.method}
                <span className="finance-chips__count">{m.count}</span>
              </Link>
            ))}
          </nav>
        )}
      </div>
      <p className="finance-debts__meta" data-testid="ops-meta">
        {pluralRu(ops.total, ['операция', 'операции', 'операций'])}
        {filtered ? ' по отбору' : ''}: оплачено <strong>{formatMoney(ops.paidMinor, cur)}</strong>,
        возвращено <strong>{formatMoney(ops.refundedMinor, cur)}</strong>.
      </p>
      {ops.rows.length === 0 ? (
        <p className="finance-debts__empty" data-testid="ops-empty">
          {filtered
            ? 'По этому отбору операций за период нет.'
            : 'Оплат и возвратов за период нет.'}
        </p>
      ) : (
        <Table size="sm" className="finance-ops__table" data-testid="ops-table">
          <thead>
            <tr>
              <th>Дата и время</th>
              <th>Тип</th>
              <th>Бронь</th>
              <th>Гость</th>
              <th>Способ</th>
              <th className="num">Сумма</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {ops.rows.map((o) => {
              const [day = '', time = ''] = o.localAt.split(' ');
              const voided = o.status === 'VOIDED';
              return (
                <tr
                  key={`${o.kind}-${o.id}`}
                  className={voided ? 'is-void' : undefined}
                  data-testid="op-row"
                  data-kind={o.kind}
                >
                  <td className="finance-debts__stay">
                    <time dateTime={o.at}>
                      {displayDate(day)}, {time}
                    </time>
                  </td>
                  <td>{operationKind(o.kind)}</td>
                  <td>
                    {o.confirmationNumber ? (
                      <Link
                        href={`/reservations/${encodeURIComponent(o.confirmationNumber)}#booking-finance`}
                        className="booking-number"
                      >
                        {o.confirmationNumber}
                      </Link>
                    ) : (
                      <span className="muted">—</span>
                    )}
                    {o.reservations > 1 && (
                      <small className="muted"> и ещё {o.reservations - 1}</small>
                    )}
                  </td>
                  <td>{o.guestLabel || <span className="muted">—</span>}</td>
                  <td>{METHOD_RU[o.method] ?? o.method}</td>
                  <td className="num" data-testid="op-amount">
                    {o.kind === 'REFUND' ? '−' : ''}
                    {formatMoney(o.amountMinor, cur)}
                  </td>
                  <td>
                    <Badge tone="neutral">{operationStatus(o.kind, o.status)}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      {!all && ops.total > ops.rows.length && (
        <Link
          href={opsHref({
            ...(opParam ? { op: opParam } : {}),
            ...(method ? { method } : {}),
            all: true,
          })}
          className="finance-debts__more"
          data-testid="ops-more"
        >
          {ops.total > OPS_ALL
            ? `Показать последние ${OPS_ALL} из ${ops.total}`
            : `Показать все ${ops.total}`}
        </Link>
      )}
      {all && ops.truncated && (
        <p className="finance-debts__note">
          Показаны последние {ops.rows.length} из {ops.total}. Полный список — в выгрузке CSV.
        </p>
      )}
    </>
  );
}

function MoneyTable({
  head,
  rows,
  cur,
  testId,
  empty,
  total,
}: {
  head: [string, string, string];
  rows: Array<{ label: string; count: number; amountMinor: string; href?: string }>;
  cur: string;
  testId: string;
  empty?: string;
  /** строка «Итого» — сверка с плиткой над таблицей */
  total?: string | undefined;
}) {
  return (
    <Table size="sm" data-testid={testId}>
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={h} className={i === 0 ? undefined : 'num'}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={3} className="muted">
              {empty}
            </td>
          </tr>
        )}
        {rows.map((x) => (
          <tr
            key={x.label}
            data-testid="report-row"
            className={x.count === 0 ? 'finance-row--zero' : undefined}
          >
            <td>{x.href ? <Link href={x.href}>{x.label}</Link> : x.label}</td>
            <td className="num">{x.count}</td>
            <td className="num">{formatMoney(x.amountMinor, cur)}</td>
          </tr>
        ))}
      </tbody>
      {total !== undefined && (
        <tfoot>
          <tr className="finance-row--total">
            <th scope="row">Итого</th>
            <td className="num">{rows.reduce((a, x) => a + x.count, 0)}</td>
            <td className="num" data-testid={`${testId}-total`}>
              {formatMoney(total, cur)}
            </td>
          </tr>
        </tfoot>
      )}
    </Table>
  );
}
