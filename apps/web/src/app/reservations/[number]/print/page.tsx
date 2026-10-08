import { sourcePrintLabels as SOURCE_RU } from '../../../../lib/status/source';
import { normalizeSearchParams, type SearchParams } from '../../../../lib/search-params';
import { api, chessboardApi, formatMinor, guestsApi } from '../../../../lib/api';
import { hotelClock } from '../../../../lib/hotel-api';
import { PrintButton } from './print-button';

/**
 * Регистрационная карта гостя — печатная форма RU / KZ (SPEC §9, CLAUDE §7).
 * Состав полей типовой; окончательное содержание заменяется образцом владельца (project-input/forms/).
 * Номер документа печатается маской: полный номер хранится только зашифрованным (SECURITY §4).
 */
const T = {
  ru: {
    title: 'Регистрационная карта гостя',
    property: 'Средство размещения',
    booking: 'Бронь №',
    guest: 'Гость',
    citizenship: 'Гражданство',
    birthDate: 'Дата рождения',
    document: 'Документ',
    phone: 'Телефон',
    stay: 'Проживание',
    category: 'Категория',
    unit: 'Номер / место',
    arrival: 'Заезд',
    departure: 'Выезд',
    nights: 'Ночей',
    price: 'Стоимость',
    source: 'Источник брони',
    consent: 'С правилами проживания ознакомлен(а). Даю согласие на обработку персональных данных.',
    guestSign: 'Подпись гостя',
    adminSign: 'Администратор',
    date: 'Дата',
    printedAt: 'Сформировано',
  },
  kz: {
    title: 'Қонақтың тіркеу карточкасы',
    property: 'Орналастыру орны',
    booking: 'Брондау №',
    guest: 'Қонақ',
    citizenship: 'Азаматтығы',
    birthDate: 'Туған күні',
    document: 'Құжат',
    phone: 'Телефон',
    stay: 'Тұру',
    category: 'Санат',
    unit: 'Нөмір / орын',
    arrival: 'Келу',
    departure: 'Кету',
    nights: 'Түн саны',
    price: 'Құны',
    source: 'Брондау көзі',
    consent: 'Тұру ережелерімен таныстым. Дербес деректерді өңдеуге келісім беремін.',
    guestSign: 'Қонақтың қолы',
    adminSign: 'Әкімші',
    date: 'Күні',
    printedAt: 'Қалыптастырылды',
  },
} as const;
const nights = (a: string, d: string) => Math.round((Date.parse(d) - Date.parse(a)) / 86_400_000);

export default async function PrintRegistrationCard({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { number } = await params;
  const { lang } = normalizeSearchParams(await searchParams);
  const t = lang === 'kz' ? T.kz : T.ru;
  const r = await chessboardApi.reservation(decodeURIComponent(number));
  const [summary, guest] = await Promise.all([
    api.inventorySummary(),
    r.primaryGuest ? guestsApi.card(r.primaryGuest.id) : Promise.resolve(null),
  ]);
  const doc = guest?.documents[0];
  // Штамп печати — по часам объекта (С-13): «2026-09-17 13:30»
  const printedAt = (await hotelClock()).printed().stamp;
  return (
    <main
      data-testid="print-registration"
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
        <a href={`/reservations/${encodeURIComponent(r.confirmationNumber)}`}>← бронь</a>
        <a href={`?lang=ru`}>RU</a>
        <a href={`?lang=kz`}>KZ</a>
        <PrintButton />
      </div>
      <h1 style={{ fontSize: 20, textAlign: 'center', margin: '0 0 4px' }}>{t.title}</h1>
      <div style={{ textAlign: 'center', fontSize: 13, marginBottom: 18 }}>
        {t.property}: <b>{summary.property.name}</b>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <tbody>
          <Row k={t.booking} v={r.confirmationNumber} />
          <Row
            k={t.guest}
            v={
              guest
                ? `${guest.lastName} ${guest.firstName} ${guest.middleName ?? ''}`.trim()
                : (r.primaryGuest?.label ?? '—')
            }
          />
          <Row k={t.birthDate} v={guest?.birthDate ?? '—'} />
          <Row k={t.citizenship} v={guest?.citizenship ?? r.primaryGuest?.citizenship ?? '—'} />
          <Row
            k={t.document}
            v={
              doc
                ? `${doc.type} ${doc.numberMasked}${doc.issueCountry ? `, ${doc.issueCountry}` : ''}`
                : '—'
            }
          />
          <Row k={t.phone} v={guest?.phone ?? '—'} />
          <Row k={t.source} v={SOURCE_RU[r.source] ?? r.source} />
        </tbody>
      </table>
      <h2 style={{ fontSize: 15, margin: '18px 0 6px' }}>{t.stay}</h2>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 14,
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
            <tr key={it.id}>
              <td style={cell}>{it.accommodationTypeName}</td>
              <td style={cell}>{it.unitCode ?? '—'}</td>
              <td style={cell}>{it.arrivalDate}</td>
              <td style={cell}>{it.departureDate}</td>
              <td style={cell}>{nights(it.arrivalDate, it.departureDate)}</td>
              <td style={{ ...cell, textAlign: 'right' }}>
                {formatMinor(it.priceMinor, r.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 13, marginTop: 18 }}>{t.consent}</p>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', marginTop: 36, fontSize: 13 }}
      >
        <div>
          {t.guestSign}: ______________________
          <br />
          <br />
          {t.date}: ____.____.________
        </div>
        <div>{t.adminSign}: ______________________</div>
      </div>
      <div style={{ fontSize: 11, color: '#555', marginTop: 24 }}>
        {t.printedAt}: {printedAt}
      </div>
    </main>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr>
      <td style={{ ...cell, width: '38%', color: '#333' }}>{k}</td>
      <td style={{ ...cell, fontWeight: 600 }}>{v}</td>
    </tr>
  );
}
const cell: React.CSSProperties = {
  padding: '5px 8px',
  border: '1px solid #000',
  textAlign: 'left',
};
