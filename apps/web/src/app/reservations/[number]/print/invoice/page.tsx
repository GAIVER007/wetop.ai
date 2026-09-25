import { normalizeSearchParams, type SearchParams } from '../../../../../lib/search-params';
import { chessboardApi, financeApi, formatMinor } from '../../../../../lib/api';
import { hotelApi } from '../../../../../lib/hotel-api';
import { PrintButton } from '../print-button';
import {
  DRAFT_BANNER,
  INVOICE_T,
  PROPERTY,
  almatyNow,
  invoiceLines,
  pickLang,
  propertyParty,
  sumMinor,
} from '../forms';

/**
 * Заготовка счёта на оплату — печатная форма RU / KZ. Номер счёта = номер брони. Строки — начисления
 * всех счетов брони (DATA_MODEL §6) без сторнированных; оплачено / к оплате — из finance API, суммы
 * в тиынах через BigInt. Реквизиты объекта — из его записи (`/hotel/settings`), банк — плейсхолдеры под образец
 * владельца.
 */
export default async function PrintInvoice({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { number } = await params;
  const { lang } = normalizeSearchParams(await searchParams);
  const l = pickLang(lang);
  const t = INVOICE_T[l];
  const r = await chessboardApi.reservation(decodeURIComponent(number));
  const [settings, finance] = await Promise.all([
    hotelApi.settings(),
    financeApi.reservation(r.confirmationNumber),
  ]);
  const party = propertyParty(settings.property);
  const lines = invoiceLines(finance);
  const total = sumMinor(lines.map((x) => x.amountMinor));
  const balance = BigInt(finance.balanceMinor);
  const now = almatyNow();
  const back = `/reservations/${encodeURIComponent(r.confirmationNumber)}`;
  return (
    <main
      data-testid="print-invoice"
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: 24,
        fontFamily: 'Georgia, "Times New Roman", serif',
        color: '#000',
        background: '#fff',
      }}
    >
      <style>{`@media print { .no-print { display: none } body { background: #fff } main { padding: 0 } }`}</style>
      <div
        className="no-print"
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 16,
          fontFamily: 'system-ui, sans-serif',
          fontSize: 13,
        }}
      >
        <a href={back}>← бронь</a>
        <a href="?lang=ru">RU</a>
        <a href="?lang=kz">KZ</a>
        <a href={`${back}/print?lang=${l}`}>регистрационная карта</a>
        <a href={`${back}/print/contract?lang=${l}`}>договор</a>
        <PrintButton />
      </div>
      <div data-testid="draft-banner" style={banner}>
        {DRAFT_BANNER}
      </div>
      <h1 style={{ fontSize: 18, textAlign: 'center', margin: '0 0 4px' }}>
        {t.title} — {t.number} {r.confirmationNumber}
      </h1>
      <div style={{ textAlign: 'center', fontSize: 13, marginBottom: 14 }}>
        {t.date}: {now.date}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <tbody>
          <tr>
            <td style={{ ...cell, width: '50%', verticalAlign: 'top' }}>
              <b>{t.property}</b>
              <br />
              {party.name} — {party.legalName}
              <br />
              {t.bin}: {party.bin}
              <br />
              {t.address}: {party.address}
              <br />
              {t.phone}: {party.phone}
              <br />
              {t.bank}: {PROPERTY.bank} · {t.iban}: {PROPERTY.iban} · {t.bic}: {PROPERTY.bic}
            </td>
            <td style={{ ...cell, verticalAlign: 'top' }}>
              <b>{t.payer}</b>
              <br />
              {r.primaryGuest?.label ?? '___'}
              <br />
              {t.booking}: {r.confirmationNumber}
              <br />
              {t.stay}:{' '}
              {r.items
                .map((it) => `${it.accommodationTypeName} ${it.arrivalDate} → ${it.departureDate}`)
                .join('; ')}
            </td>
          </tr>
        </tbody>
      </table>

      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 13,
          border: '1px solid #000',
          marginTop: 14,
        }}
      >
        <thead>
          <tr>
            {[t.lineNo, t.description, t.serviceDate, t.quantity, t.unitPrice, t.amount].map(
              (h) => (
                <th key={h} style={cell}>
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 && (
            <tr>
              <td colSpan={6} style={{ ...cell, color: '#555' }}>
                {t.noLines}
              </td>
            </tr>
          )}
          {lines.map((x, i) => (
            <tr key={x.id} data-testid="invoice-line" data-kind={x.kind}>
              <td style={cell}>{i + 1}</td>
              <td style={cell}>{x.description}</td>
              <td style={cell}>{x.serviceDate ?? '—'}</td>
              <td style={{ ...cell, textAlign: 'right' }}>{x.quantity}</td>
              <td style={{ ...cell, textAlign: 'right' }}>
                {formatMinor(x.unitPriceMinor, finance.currency)}
              </td>
              <td style={{ ...cell, textAlign: 'right' }}>
                {formatMinor(x.amountMinor, finance.currency)}
              </td>
            </tr>
          ))}
          <Total
            label={t.total}
            value={formatMinor(total, finance.currency)}
            testId="invoice-total"
          />
          <Total label={t.paid} value={formatMinor(finance.paidMinor, finance.currency)} />
          {finance.refundedMinor !== '0' && (
            <Total
              label={t.refunded}
              value={formatMinor(finance.refundedMinor, finance.currency)}
            />
          )}
          <Total
            label={balance > 0n ? t.due : balance < 0n ? t.overpaid : t.settled}
            value={formatMinor((balance < 0n ? -balance : balance).toString(), finance.currency)}
            testId="invoice-due"
            bold
          />
        </tbody>
      </table>

      <div style={{ marginTop: 32, fontSize: 13 }}>{t.signature}: ______________________</div>
      <div style={{ fontSize: 11, color: '#555', marginTop: 24 }}>
        {t.printedAt}: {now.stamp}
      </div>
    </main>
  );
}

function Total({
  label,
  value,
  testId,
  bold,
}: {
  label: string;
  value: string;
  testId?: string;
  bold?: boolean;
}) {
  return (
    <tr>
      <td colSpan={5} style={{ ...cell, textAlign: 'right' }}>
        {bold ? <b>{label}</b> : label}
      </td>
      <td style={{ ...cell, textAlign: 'right' }} data-testid={testId}>
        {bold ? <b>{value}</b> : value}
      </td>
    </tr>
  );
}

const banner: React.CSSProperties = {
  background: '#fef3c7',
  border: '2px dashed #b45309',
  color: '#7c2d12',
  fontFamily: 'system-ui, sans-serif',
  fontWeight: 700,
  fontSize: 14,
  textAlign: 'center',
  padding: '8px 12px',
  marginBottom: 16,
};
const cell: React.CSSProperties = {
  padding: '5px 8px',
  border: '1px solid #000',
  textAlign: 'left',
};
