import type { ReactNode } from 'react';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import Link from 'next/link';
import { Icon } from '../../components/icon';
import { hotelToday, reservationStatusWords, validDate } from '../../lib/hotel-api';
import { nightsBetween, pluralRu } from '../../lib/plural';
import { displayDate } from '../../lib/display-date';
import { financeApi, type PeriodDebts, type PeriodReport } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { deskShell } from '../../lib/desk-shell';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import {
  Alert,
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

/** Тот же предел, что у `/finance/report`: год с запасом (волна 4) */
const MAX_REPORT_DAYS = 366;
/** Сколько строк долгов видно сразу; остальные — по «Показать все» */
const DEBTS_SHOWN = 20;

/** Четыре вида начислений всегда в одном порядке: владелец видит всю структуру, а не только ненулевое */
const KINDS: Array<[string, string]> = [
  ['ACCOMMODATION', 'Проживание'],
  ['SERVICE', 'Услуги'],
  ['PENALTY', 'Штрафы'],
  ['ADJUSTMENT', 'Корректировки'],
];
const METHOD_RU: Record<string, string> = {
  CASH: 'Наличные',
  CARD_TERMINAL: 'Карта (терминал)',
  KASPI: 'Kaspi',
  HALYK: 'Halyk',
  BANK_TRANSFER_PERSON: 'Перевод от физлица',
  BANK_TRANSFER_LEGAL: 'Перевод от юрлица',
  DEPOSIT: 'Депозит',
  CARD_GUARANTEE: 'Гарантия картой',
  EXTERNAL: 'Внешний (канал / Exely)',
};

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
 * «Финансы за период», срез F1 (ADR-107, план `plans/finance-f1-2026-09-27.md`). Экран отвечает на три вопроса
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
  const [loaded, debtsLoaded, shell] = await Promise.all([
    valid ? settle(financeApi.report(from, to)) : null,
    valid ? settle(financeApi.debts(from, to)) : null,
    deskShell(),
  ]);
  const r = loaded?.ok ? loaded.r : null;
  const loadError = loaded && !loaded.ok ? loaded.e : null;
  const debts = debtsLoaded?.ok ? debtsLoaded.r : null;
  const debtsError = debtsLoaded && !debtsLoaded.ok ? debtsLoaded.e : null;
  const cur = r?.currency ?? debts?.currency ?? '';
  const withYear = from.slice(0, 4) !== to.slice(0, 4);
  const periodText =
    from === to
      ? displayDate(from, 'numeric')
      : `${displayDate(from, withYear ? 'numeric' : 'short')} → ${displayDate(to, withYear ? 'numeric' : 'short')}`;
  const period = `/finance?from=${from}&to=${to}`;
  const preset = (p: { from: string; to: string }) => `/finance?from=${p.from}&to=${p.to}`;
  const isPreset = (p: { from: string; to: string }) => p.from === from && p.to === to;
  const due = r ? BigInt(r.balanceMinor) : 0n;
  const onlyLeft = sp.debts === 'left';
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
          <Stat
            label="Начислено"
            value={formatMoney(r.chargedMinor, cur)}
            testId="charged"
            hint="проживание, услуги, штрафы"
          />
          <Stat
            label="Оплачено"
            value={formatMoney(r.paidMinor, cur)}
            testId="paid"
            hint="всеми способами оплаты"
          />
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
          {/* Плитка ведёт к списку, который объясняет число (ТЗ: клик по «К сбору» — к долгам) */}
          <a
            href={`${period}#debts`}
            className={due > 0n ? 'finance-kpi-link finance-kpi-link--due' : 'finance-kpi-link'}
            data-testid="kpi-due"
          >
            <Stat
              label="К сбору"
              value={formatMoney(r.balanceMinor, cur)}
              testId="balance"
              tone={due > 0n ? 'warn' : undefined}
              hint="начислено − оплачено + возвращено"
            />
          </a>
        </section>
      )}

      {valid && (r || debts) && (
        <Attention report={r} debts={debts} debtsFailed={debtsError !== null} period={period} />
      )}

      {r && (
        <div className="finance-structure">
          <section className="finance-block" data-testid="finance-charges">
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
            <SectionTitle>Проживание по категориям</SectionTitle>
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
              }))}
              total={r.paymentsByMethod.length ? r.paidMinor : undefined}
            />
          </section>
        </div>
      )}

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
                  className={onlyLeft ? '' : 'is-active'}
                  aria-current={onlyLeft ? undefined : 'page'}
                >
                  Все<span className="finance-chips__count">{debts.count}</span>
                </Link>
                <Link
                  href={`${period}&debts=left#debts`}
                  className={onlyLeft ? 'is-active' : ''}
                  aria-current={onlyLeft ? 'page' : undefined}
                >
                  Гость выехал
                  <span className="finance-chips__count">{debts.checkedOut.count}</span>
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
              report={r}
              onlyLeft={onlyLeft}
              showAll={sp.more === '1'}
              period={period}
              canPay={!shell.readOnly}
            />
          )}
        </section>
      )}

      <Help title="Как считаются суммы">
        <p>
          «К сбору» в итогах — деньги только этого периода: начислено − оплачено + возвращено за эти
          даты. Список «Брони с остатком к сбору» — брони с начислениями за период и полный остаток
          каждой по её счёту, как в карточке брони.
        </p>
        <p>
          У броней, перенесённых из Exely, могут отсутствовать оплаты, полученные площадкой.
          Проверьте их перед взысканием остатка.
        </p>
      </Help>
    </Page>
  );
}

/**
 * «Требует внимания»: только то, что можно посчитать по данным, и со ссылкой туда, где с этим работают.
 * «Просроченного долга» и «наличных на проверку» здесь нет: у брони нет срока оплаты, у наличных — отметки
 * проверки (Q-200). Возвраты — справкой: списка операций в F1 нет.
 */
function Attention({
  report,
  debts,
  debtsFailed,
  period,
}: {
  report: PeriodReport | null;
  debts: PeriodDebts | null;
  debtsFailed: boolean;
  period: string;
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
  if (debts && debts.checkedOut.count > 0)
    items.push({
      key: 'left',
      tone: 'danger',
      body: (
        <Link href={`${period}&debts=left#debts`}>
          <strong>{pluralRu(debts.checkedOut.count, ['бронь', 'брони', 'броней'])}</strong>: гость
          уже выехал, остаток {formatMoney(debts.checkedOut.balanceMinor, cur)}
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
        <span>
          {pluralRu(report.refunds.count, ['возврат', 'возврата', 'возвратов'])} за период на{' '}
          {formatMoney(report.refunds.amountMinor, cur)}
        </span>
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
  report,
  onlyLeft,
  showAll,
  period,
  canPay,
}: {
  debts: PeriodDebts;
  report: PeriodReport | null;
  onlyLeft: boolean;
  showAll: boolean;
  period: string;
  canPay: boolean;
}) {
  const cur = debts.currency;
  const rows = onlyLeft ? debts.rows.filter((x) => x.status === 'CHECKED_OUT') : debts.rows;
  const shown = showAll ? rows : rows.slice(0, DEBTS_SHOWN);
  const total = onlyLeft ? debts.checkedOut : debts;
  if (debts.count === 0)
    return (
      <p className="finance-debts__empty" data-testid="debts-empty">
        <Icon name="check" />
        Все брони с начислениями за период оплачены.
      </p>
    );
  // Плитка считает деньги периода, список — полный остаток брони: когда они расходятся, сказать почему
  const differs = report !== null && !onlyLeft && report.balanceMinor !== debts.balanceMinor;
  return (
    <>
      <p className="finance-debts__meta" data-testid="debts-meta">
        {pluralRu(total.count, ['бронь', 'брони', 'броней'])}
        {onlyLeft ? ', гость уже выехал' : ''}, остаток{' '}
        <strong>{formatMoney(total.balanceMinor, cur)}</strong>. Остаток — по всему счёту брони, как
        в карточке; «Оплачено» — за вычетом возвратов.
      </p>
      {differs && (
        <p className="finance-debts__note" data-testid="debts-differs">
          «К сбору» в итогах — {formatMoney(report.balanceMinor, cur)}: там только деньги этого
          периода. Список показывает полный остаток брони, поэтому суммы расходятся, когда бронь
          оплатили в другом периоде или часть её начислений лежит вне периода.
        </p>
      )}
      {rows.length === 0 ? (
        <p className="finance-debts__empty">Среди должников периода выехавших нет.</p>
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
          href={`${period}${onlyLeft ? '&debts=left' : ''}&more=1#debts`}
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

function MoneyTable({
  head,
  rows,
  cur,
  testId,
  empty,
  total,
}: {
  head: [string, string, string];
  rows: Array<{ label: string; count: number; amountMinor: string }>;
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
            <td>{x.label}</td>
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
