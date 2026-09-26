import { normalizeSearchParams, type SearchParams } from '../../../../../lib/search-params';
import { chessboardApi, formatMinor, guestsApi } from '../../../../../lib/api';
import { hotelApi, hotelClock } from '../../../../../lib/hotel-api';
import { PrintButton } from '../print-button';
import {
  CONTRACT_T,
  DRAFT_BANNER,
  PROPERTY,
  cancellationRule,
  nightsBetween,
  pickLang,
  propertyParty,
} from '../forms';

/**
 * Заготовка договора на проживание — печатная форма RU / KZ по образцу регистрационной карты.
 * Стороны: объект (реквизиты из его записи, `/hotel/settings`; банк — плейсхолдеры) и гость (документ — маской,
 * полный номер хранится только зашифрованным, SECURITY §4). Содержание заменит образец владельца.
 */
export default async function PrintContract({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { number } = await params;
  const { lang } = normalizeSearchParams(await searchParams);
  const l = pickLang(lang);
  const t = CONTRACT_T[l];
  const r = await chessboardApi.reservation(decodeURIComponent(number));
  const [settings, guest] = await Promise.all([
    hotelApi.settings(),
    r.primaryGuest ? guestsApi.card(r.primaryGuest.id) : Promise.resolve(null),
  ]);
  const party = propertyParty(settings.property);
  const doc = guest?.documents[0];
  const now = (await hotelClock()).printed();
  const guestName = guest
    ? `${guest.lastName} ${guest.firstName} ${guest.middleName ?? ''}`.trim()
    : (r.primaryGuest?.label ?? '—');
  const back = `/reservations/${encodeURIComponent(r.confirmationNumber)}`;
  return (
    <main
      data-testid="print-contract"
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
        <a href={`${back}/print/invoice?lang=${l}`}>счёт</a>
        <PrintButton />
      </div>
      <div data-testid="draft-banner" style={banner}>
        {DRAFT_BANNER}
      </div>
      <h1 style={{ fontSize: 18, textAlign: 'center', margin: '0 0 4px' }}>{t.title}</h1>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
        <span>
          {t.number} <b>{r.confirmationNumber}</b>
        </span>
        <span>{t.city}</span>
        <span>
          {t.date}: {now.date}
        </span>
      </div>

      <h2 style={h2}>{t.parties}</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <tbody>
          <tr>
            <td style={{ ...cell, width: '50%', verticalAlign: 'top' }}>
              <b>{t.propertyParty}</b>
              <br />
              {party.name} — {party.legalName}
              <br />
              {t.bin}: {party.bin}
              <br />
              {t.address}: {party.address}
              <br />
              {t.phone}: {party.phone} · {t.email}: {party.email}
              <br />
              {t.bank}: {PROPERTY.bank} · {t.iban}: {PROPERTY.iban} · {t.bic}: {PROPERTY.bic}
            </td>
            <td style={{ ...cell, verticalAlign: 'top' }}>
              <b>{t.guestParty}</b>
              <br />
              {guestName}
              <br />
              {t.citizenship}: {guest?.citizenship ?? r.primaryGuest?.citizenship ?? '___'}
              <br />
              {t.document}:{' '}
              {doc
                ? `${doc.type} ${doc.numberMasked}${doc.issueCountry ? `, ${doc.issueCountry}` : ''}`
                : '___'}
              <br />
              {t.phone}: {guest?.phone ?? r.primaryGuest?.phone ?? '___'}
            </td>
          </tr>
        </tbody>
      </table>

      <h2 style={h2}>{t.subject}</h2>
      <p style={{ fontSize: 13, margin: '0 0 8px' }}>{t.subjectText}</p>

      <h2 style={h2}>{t.stay}</h2>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 13,
          border: '1px solid #000',
        }}
      >
        <thead>
          <tr>
            {[t.category, t.unit, t.arrival, t.departure, t.nights, t.price].map((h) => (
              <th key={h} style={cell}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {r.items.map((it) => (
            <tr key={it.id} data-testid="contract-stay">
              <td style={cell}>{it.accommodationTypeName}</td>
              <td style={cell}>{it.unitCode ?? '—'}</td>
              <td style={cell}>{it.arrivalDate}</td>
              <td style={cell}>{it.departureDate}</td>
              <td style={cell}>{nightsBetween(it.arrivalDate, it.departureDate)}</td>
              <td style={{ ...cell, textAlign: 'right' }}>
                {formatMinor(it.priceMinor, r.currency)}
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={5} style={{ ...cell, textAlign: 'right' }}>
              <b>{t.total}</b>
            </td>
            <td style={{ ...cell, textAlign: 'right' }} data-testid="contract-total">
              <b>{formatMinor(r.totalAmountMinor, r.currency)}</b>
            </td>
          </tr>
        </tbody>
      </table>
      <p style={{ fontSize: 13, margin: '8px 0 0' }}>
        {t.checkInTime}: {party.checkInTime} · {t.checkOutTime}: {party.checkOutTime} ·{' '}
        {t.tariff}: ___
      </p>

      <h2 style={h2}>{t.cancellation}</h2>
      <p style={{ fontSize: 13, margin: 0 }}>{cancellationRule(l)}</p>

      <h2 style={h2}>{t.signatures}</h2>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, fontSize: 13 }}
      >
        <div>
          {t.propertySign}: ______________________
          <br />
          <span style={{ fontSize: 11 }}>{PROPERTY.signer}</span>
        </div>
        <div>
          {t.guestSign}: ______________________
          <br />
          <span style={{ fontSize: 11 }}>{guestName}</span>
        </div>
      </div>
      <div style={{ fontSize: 11, color: '#555', marginTop: 24 }}>
        {t.printedAt}: {now.stamp}
      </div>
    </main>
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
const h2: React.CSSProperties = { fontSize: 14, margin: '16px 0 6px' };
const cell: React.CSSProperties = {
  padding: '5px 8px',
  border: '1px solid #000',
  textAlign: 'left',
};
