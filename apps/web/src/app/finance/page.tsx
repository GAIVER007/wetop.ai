import Link from 'next/link';
import { financeApi, formatMinor } from '../../lib/api';

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
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const def = currentMonth();
  const from = sp.from || def.from;
  const to = sp.to || def.to;
  const r = await financeApi.report(from, to);
  const cur = r.currency;
  return (
    <main style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 20px 48px' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 14 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Деньги за период</h1>
        <nav style={{ display: 'flex', gap: 10, marginLeft: 'auto', fontSize: 14 }}>
          <Link href="/chessboard">шахматка</Link>
          <Link href="/rates">цены</Link>
          <Link href="/journal">журнал</Link>
        </nav>
      </header>

      <form method="get" style={row} data-testid="period-form">
        <label style={lbl}>
          с <input type="date" name="from" defaultValue={from} style={inp} />
        </label>
        <label style={lbl}>
          по <input type="date" name="to" defaultValue={to} style={inp} />
        </label>
        <button type="submit" style={btn}>
          Показать
        </button>
      </form>

      <section style={cards}>
        <Card label="Начислено" value={formatMinor(r.chargedMinor, cur)} testId="charged" />
        <Card label="Оплачено" value={formatMinor(r.paidMinor, cur)} testId="paid" />
        <Card label="Возвращено" value={formatMinor(r.refundedMinor, cur)} testId="refunded" />
        <Card
          label="Не собрано"
          value={formatMinor(r.balanceMinor, cur)}
          testId="balance"
          hint="начислено − оплачено + возвращено"
        />
      </section>

      <Table
        title="Начисления по видам"
        testId="charges-table"
        head={['Вид', 'Штук', 'Сумма']}
        rows={r.chargesByKind.map((x) => [
          KIND_RU[x.kind] ?? x.kind,
          String(x.count),
          formatMinor(x.amountMinor, cur),
        ])}
      />
      <Table
        title="Оплаты по способам"
        testId="payments-table"
        head={['Способ', 'Штук', 'Сумма']}
        rows={r.paymentsByMethod.map((x) => [
          METHOD_RU[x.method] ?? x.method,
          String(x.count),
          formatMinor(x.amountMinor, cur),
        ])}
      />
      <Table
        title="Проживание по категориям"
        testId="category-table"
        head={['Категория', 'Начислений', 'Сумма']}
        rows={r.accommodationByCategory.map((x) => [
          x.category,
          String(x.count),
          formatMinor(x.amountMinor, cur),
        ])}
      />
      <p style={{ fontSize: 12, color: '#666', marginTop: 18 }}>
        Начисления считаются по дате услуги, оплаты и возвраты — по дате операции. Это разные базы:
        сумма оплат за период не обязана совпадать с начислениями, потому что платят и авансом, и
        позже.
        <br />
        «Не собрано» по броням, перенесённым из Exely, завышено: деньги, собранные площадкой
        (Trip.com, Agoda, Expedia, Островок), Exely к проживанию не привязывал. У новых броней из
        каналов это учитывается автоматически. Разбор — reports/unpaid-by-channel-2026-08.md.
      </p>
    </main>
  );
}

function Card({
  label,
  value,
  testId,
  hint,
}: {
  label: string;
  value: string;
  testId: string;
  hint?: string;
}) {
  return (
    <div style={card}>
      <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600 }} data-testid={testId}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 11, color: '#888' }}>{hint}</div>}
    </div>
  );
}

function Table({
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
      <h2 style={{ fontSize: 16, margin: '20px 0 8px' }}>{title}</h2>
      <table style={table} data-testid={testId}>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} style={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td style={td} colSpan={head.length}>
                за период пусто
              </td>
            </tr>
          )}
          {rows.map((cells) => (
            <tr key={cells[0]} data-testid="report-row">
              {cells.map((c, i) => (
                <td key={i} style={{ ...td, textAlign: i === 0 ? 'left' : 'right' }}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

const row: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  marginBottom: 16,
};
const lbl: React.CSSProperties = {
  fontSize: 13,
  color: '#555',
  display: 'flex',
  gap: 6,
  alignItems: 'center',
};
const inp: React.CSSProperties = {
  padding: '6px 8px',
  border: '1px solid #cbd0d6',
  borderRadius: 6,
  fontSize: 14,
};
const btn: React.CSSProperties = {
  padding: '7px 14px',
  border: 0,
  borderRadius: 6,
  background: '#1d4ed8',
  color: '#fff',
  fontSize: 14,
  cursor: 'pointer',
};
const cards: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
  gap: 12,
};
const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e3e5e8',
  borderRadius: 8,
  padding: '10px 12px',
};
const table: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  background: '#fff',
  border: '1px solid #e3e5e8',
  borderRadius: 8,
  fontSize: 14,
};
const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '1px solid #e3e5e8',
  fontSize: 12,
  color: '#666',
};
const td: React.CSSProperties = { padding: '7px 10px', borderBottom: '1px solid #f0f1f3' };
