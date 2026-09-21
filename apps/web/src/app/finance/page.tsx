import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import Link from 'next/link';
import { Icon } from '../../components/icon';
import { validDate } from '../../lib/hotel-api';
import { nightsBetween, pluralRu } from '../../lib/plural';
import { displayDate } from '../../lib/display-date';
import { financeApi } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import {
  Alert,
  Button,
  Field,
  Help,
  Input,
  SectionTitle,
  Stat,
  Stats,
  Table,
} from '../../components/ui';
import '../directory.css';

/** Тот же предел, что у `/finance/report`: год с запасом (волна 4) */
const MAX_REPORT_DAYS = 366;

const KIND_RU: Record<string, string> = {
  ACCOMMODATION: 'проживание',
  SERVICE: 'услуги',
  PENALTY: 'штрафы',
  ADJUSTMENT: 'корректировки',
};
const METHOD_RU: Record<string, string> = {
  CASH: 'наличные',
  CARD_TERMINAL: 'карта (терминал)',
  KASPI: 'Kaspi',
  HALYK: 'Halyk',
  BANK_TRANSFER_PERSON: 'перевод от физлица',
  BANK_TRANSFER_LEGAL: 'перевод от юрлица',
  DEPOSIT: 'депозит',
  CARD_GUARANTEE: 'гарантия картой',
  EXTERNAL: 'внешний (канал / Exely)',
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
/** Сегодня и границы месяцев в часах объекта (Asia/Almaty, UTC+5). */
function almaty() {
  const now = new Date(Date.now() + 5 * 3600 * 1000);
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return {
    today: iso(now),
    month: { from: iso(new Date(Date.UTC(y, m, 1))), to: iso(new Date(Date.UTC(y, m + 1, 0))) },
    prevMonth: { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: iso(new Date(Date.UTC(y, m, 0))) },
    week: { from: iso(new Date(now.getTime() - 6 * 86400000)), to: iso(now) },
  };
}

/**
 * T4: финансовый учёт за период. D2 (план владельца 19.09): период назван словами и переключается
 * готовыми отрезками; начисления, поступления с возвратами и остаток — тремя блоками, у каждого числа
 * написано, что оно значит; отказ API не выдаётся за нули — экран остаётся, вместо чисел сбой со
 * следующим шагом. Расчёт сумм на сервере не менялся.
 */
export default async function FinanceReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = normalizeSearchParams(await searchParams);
  const cal = almaty();
  const from = sp.from || cal.month.from;
  const to = sp.to || cal.month.to;
  const dates = validDate(from) && validDate(to) && from <= to;
  // Тот же предел, что в API: иначе страница уходит в общий экран ошибки без дат и без формы (§7.4)
  const days = dates ? nightsBetween(from, to) + 1 : 0;
  const tooLong = dates && days > MAX_REPORT_DAYS;
  const valid = dates && !tooLong;
  const loaded = valid
    ? await financeApi.report(from, to).then(
        (r) => ({ ok: true as const, r }),
        (e: unknown) => ({ ok: false as const, e }),
      )
    : null;
  const r = loaded?.ok ? loaded.r : null;
  const loadError = loaded && !loaded.ok ? loaded.e : null;
  const cur = r?.currency ?? '';
  const withYear = from.slice(0, 4) !== to.slice(0, 4);
  const periodText =
    from === to
      ? displayDate(from, 'numeric')
      : `${displayDate(from, withYear ? 'numeric' : 'short')} → ${displayDate(to, withYear ? 'numeric' : 'short')}`;
  const preset = (p: { from: string; to: string }) => `/finance?from=${p.from}&to=${p.to}`;
  const isPreset = (p: { from: string; to: string }) => p.from === from && p.to === to;
  const due = r ? BigInt(r.balanceMinor) : 0n;
  return (
    <Page
      title="Деньги за период"
      // Оплату принимают на счёте брони; отсюда можно только пойти её искать (§7.3)
      actions={
        <Link href="/reservations" className="btn">
          <Icon name="search" />
          Найти бронь для оплаты
        </Link>
      }
    >
      <form
        method="get"
        className="row row--lg toolbar directory-toolbar"
        data-testid="period-form"
      >
        <Field inline label="С">
          <Input
            key={`from-${from}`}
            type="date"
            name="from"
            defaultValue={from}
            aria-label="Период: с"
          />
        </Field>
        <Field inline label="По">
          <Input key={`to-${to}`} type="date" name="to" defaultValue={to} aria-label="Период: по" />
        </Field>
        <Button type="submit">Показать</Button>
      </form>
      {/* Готовые отрезки — ссылками, как на главной: период виден в адресе и в подписи ниже */}
      <nav className="directory-filters" aria-label="Готовые периоды">
        {(
          [
            ['Сегодня', { from: cal.today, to: cal.today }],
            ['7 дней', cal.week],
            ['Этот месяц', cal.month],
            ['Прошлый месяц', cal.prevMonth],
          ] as const
        ).map(([label, p]) => (
          <Link key={label} href={preset(p)} className={isPreset(p) ? 'is-active' : ''}>
            {label}
          </Link>
        ))}
      </nav>

      {tooLong && (
        <Alert boxed>
          Период отчёта — не больше года ({MAX_REPORT_DAYS} дней) за один запрос. Укоротите период:
          за год и дольше это уже выгрузка, а не экран.
        </Alert>
      )}
      {!dates && (
        <Alert boxed>Проверьте даты: окончание периода должно быть не раньше начала.</Alert>
      )}
      {valid && (
        <p className="directory-meta" data-testid="finance-period">
          Период {periodText}, {pluralRu(days, ['день', 'дня', 'дней'])}. Начисления — по дате
          услуги, оплаты и возвраты — по дате операции.
        </p>
      )}
      {loadError !== null && <LoadError testId="finance-error" {...loadErrorProps(loadError)} />}
      {r && (
        <div className="finance-blocks">
          <section className="finance-block" data-testid="finance-charges">
            <SectionTitle first>Начислено гостям</SectionTitle>
            <Stats min={170}>
              <Stat
                label="Начислено"
                value={formatMoney(r.chargedMinor, cur)}
                testId="charged"
                hint="проживание, услуги, штрафы и корректировки за период"
              />
            </Stats>
            <Report
              title="По видам начислений"
              testId="charges-table"
              head={['Вид', 'Штук', 'Сумма']}
              empty="Начислений за период нет"
              rows={r.chargesByKind.map((x) => [
                KIND_RU[x.kind] ?? x.kind,
                String(x.count),
                formatMoney(x.amountMinor, cur),
              ])}
            />
            <Report
              title="Проживание по категориям"
              testId="category-table"
              head={['Категория', 'Начислений', 'Сумма']}
              empty="Начислений за проживание за период нет"
              rows={r.accommodationByCategory.map((x) => [
                x.category,
                String(x.count),
                formatMoney(x.amountMinor, cur),
              ])}
            />
          </section>
          <section className="finance-block" data-testid="finance-money">
            <SectionTitle first>Деньги на руках</SectionTitle>
            <Stats min={170}>
              <Stat
                label="Оплачено"
                value={formatMoney(r.paidMinor, cur)}
                testId="paid"
                hint="поступления всеми способами"
              />
              <Stat
                label="Возвращено"
                value={formatMoney(r.refundedMinor, cur)}
                testId="refunded"
                hint={
                  r.refunds.count
                    ? `${pluralRu(r.refunds.count, ['возврат', 'возврата', 'возвратов'])} гостям`
                    : 'возвратов не было'
                }
              />
            </Stats>
            <Report
              title="Оплаты по способам"
              testId="payments-table"
              head={['Способ', 'Штук', 'Сумма']}
              empty="Оплат за период нет"
              rows={r.paymentsByMethod.map((x) => [
                METHOD_RU[x.method] ?? x.method,
                String(x.count),
                formatMoney(x.amountMinor, cur),
              ])}
            />
          </section>
          <section className="finance-block finance-block--due" data-testid="finance-due">
            <SectionTitle first>Остаток к сбору</SectionTitle>
            <Stats min={170}>
              <Stat
                label="Не собрано"
                value={formatMoney(r.balanceMinor, cur)}
                testId="balance"
                tone={due > 0n ? 'warn' : undefined}
                hint="начислено − оплачено + возвращено"
              />
            </Stats>
            <p className="hint">
              {due > 0n
                ? 'Долг гостей по счетам за период. Взыскать можно только на счёте брони: найдите её по фамилии или номеру.'
                : 'За период всё начисленное оплачено.'}
            </p>
          </section>
        </div>
      )}
      <Help title="Как считаются суммы">
        <p>Начисления — по дате услуги, оплаты и возвраты — по дате операции.</p>
        <p>
          У броней, перенесённых из Exely, могут отсутствовать оплаты, полученные площадкой.
          Проверьте их перед взысканием остатка.
        </p>
      </Help>
    </Page>
  );
}

function Report({
  title,
  head,
  rows,
  testId,
  empty,
}: {
  title: string;
  head: string[];
  rows: string[][];
  testId: string;
  empty: string;
}) {
  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      <Table data-testid={testId}>
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
              <td colSpan={head.length} className="muted">
                {empty}
              </td>
            </tr>
          )}
          {rows.map((cells) => (
            <tr key={cells[0]} data-testid="report-row">
              {cells.map((c, i) => (
                <td key={i} className={i === 0 ? undefined : 'num'}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
