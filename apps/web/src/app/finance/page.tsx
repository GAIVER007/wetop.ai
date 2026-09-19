import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import Link from 'next/link';
import { Icon } from '../../components/icon';
import { validDate } from '../../lib/hotel-api';
import { nightsBetween } from '../../lib/plural';

/** Тот же предел, что у `/finance/report`: год с запасом (волна 4) */
const MAX_REPORT_DAYS = 366;
import { financeApi, formatMinor } from '../../lib/api';
import { Page } from '../../components/page';
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

/** Первое и последнее число текущего месяца в часах объекта (Asia/Almaty, UTC+5). */
function currentMonth(): { from: string; to: string } {
  const now = new Date(Date.now() + 5 * 3600 * 1000);
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(new Date(Date.UTC(y, m, 1))), to: iso(new Date(Date.UTC(y, m + 1, 0))) };
}

/** T4: финансовый учёт за период — начисления, оплаты, возвраты и разрезы. */
export default async function FinanceReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = normalizeSearchParams(await searchParams);
  const def = currentMonth();
  const from = sp.from || def.from;
  const to = sp.to || def.to;
  const dates = validDate(from) && validDate(to) && from <= to;
  // Тот же предел, что в API: иначе страница уходит в общий экран ошибки без дат и без формы (§7.4)
  const tooLong = dates && nightsBetween(from, to) + 1 > MAX_REPORT_DAYS;
  const valid = dates && !tooLong;
  const r = valid ? await financeApi.report(from, to) : null;
  const cur = r?.currency ?? '';
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
      <form method="get" className="row row--lg toolbar" data-testid="period-form">
        <Field inline label="с">
          <Input type="date" name="from" defaultValue={from} />
        </Field>
        <Field inline label="по">
          <Input type="date" name="to" defaultValue={to} />
        </Field>
        <Button type="submit">Показать</Button>
      </form>

      {tooLong && (
        <Alert boxed>
          Период — не больше {MAX_REPORT_DAYS} дней за один запрос. Укоротите период: за год и
          дольше это уже выгрузка, а не экран.
        </Alert>
      )}
      {!dates && (
        <Alert boxed>Проверьте даты: окончание периода должно быть не раньше начала.</Alert>
      )}
      {tooLong && (
        <Alert boxed>
          Период отчёта — не больше года (366 дней). Выберите более короткий отрезок.
        </Alert>
      )}
      {r && (
        <>
          <Stats min={170}>
            <Stat label="Начислено" value={formatMinor(r.chargedMinor, cur)} testId="charged" />
            <Stat label="Оплачено" value={formatMinor(r.paidMinor, cur)} testId="paid" />
            <Stat label="Возвращено" value={formatMinor(r.refundedMinor, cur)} testId="refunded" />
            <Stat
              label="Не собрано"
              value={formatMinor(r.balanceMinor, cur)}
              testId="balance"
              hint="начислено − оплачено + возвращено"
            />
          </Stats>

          <Report
            title="Начисления по видам"
            testId="charges-table"
            head={['Вид', 'Штук', 'Сумма']}
            rows={r.chargesByKind.map((x) => [
              KIND_RU[x.kind] ?? x.kind,
              String(x.count),
              formatMinor(x.amountMinor, cur),
            ])}
          />
          <Report
            title="Оплаты по способам"
            testId="payments-table"
            head={['Способ', 'Штук', 'Сумма']}
            rows={r.paymentsByMethod.map((x) => [
              METHOD_RU[x.method] ?? x.method,
              String(x.count),
              formatMinor(x.amountMinor, cur),
            ])}
          />
          <Report
            title="Проживание по категориям"
            testId="category-table"
            head={['Категория', 'Начислений', 'Сумма']}
            rows={r.accommodationByCategory.map((x) => [
              x.category,
              String(x.count),
              formatMinor(x.amountMinor, cur),
            ])}
          />
        </>
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
}: {
  title: string;
  head: string[];
  rows: string[][];
  testId: string;
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
                за период пусто
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
