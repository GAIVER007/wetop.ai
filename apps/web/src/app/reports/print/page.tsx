import { requireVertical } from '../../../lib/vertical-guard';
import { isIsoDate } from '@pms/domain';
import { normalizeSearchParams, type SearchParams } from '../../../lib/search-params';
import { api, deskApi, type DeskRow } from '../../../lib/api';
import { hotelClock } from '../../../lib/hotel-api';
import { PrintButton } from '../../reservations/[number]/print/print-button';

/**
 * Печатные формы дня (REP4, план `plans/reports-hub-2026-10-02.md` §3): «Сводка дня» и «Список
 * проживающих» на одном `GET /desk/today`. Приём — регистрационная карта (`reservations/[number]/print`):
 * отдельный лист serif-вёрсткой, RU и KZ (CLAUDE §7), штамп по часам объекта. Телефонов, документов,
 * гражданства и денег на листе нет: бумага уходит из системы (SECURITY §4).
 */
const T = {
  ru: {
    day: 'Сводка дня',
    inhouse: 'Список проживающих',
    property: 'Средство размещения',
    date: 'Дата',
    arrivals: 'Заезды',
    departures: 'Выезды',
    inHouse: 'Проживают',
    overdue: 'Не заехали вовремя',
    guest: 'Гость',
    category: 'Категория',
    unit: 'Номер / место',
    arrival: 'Заезд',
    departure: 'Выезд',
    guests: 'Гостей',
    none: 'нет',
    printedAt: 'Сформировано',
  },
  kz: {
    day: 'Күн бойынша жиынтық',
    inhouse: 'Тұрып жатқан қонақтар тізімі',
    property: 'Орналастыру орны',
    date: 'Күні',
    arrivals: 'Келулер',
    departures: 'Кетулер',
    inHouse: 'Тұрып жатыр',
    overdue: 'Уақытында келмегендер',
    guest: 'Қонақ',
    category: 'Санат',
    unit: 'Нөмір / орын',
    arrival: 'Келу',
    departure: 'Кету',
    guests: 'Қонақ саны',
    none: 'жоқ',
    printedAt: 'Қалыптастырылды',
  },
} as const;
const ddmmyyyy = (iso: string) => iso.split('-').reverse().join('.');

export default async function PrintDaySheet({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireVertical(['HOSPITALITY']);
  const sp = normalizeSearchParams(await searchParams);
  const language = sp.lang === 'kz' ? 'kz' : 'ru';
  const t = T[language];
  const form = sp.form === 'inhouse' ? 'inhouse' : 'day';
  const clock = await hotelClock();
  const date = isIsoDate(sp.date) ? sp.date : clock.today();
  const [day, summary] = await Promise.all([deskApi.today(date), api.inventorySummary()]);
  const printedAt = clock.printed().stamp;
  const qs = (f: string, lang = language) =>
    `?form=${f}${sp.date || date !== clock.today() ? `&date=${date}` : ''}&lang=${lang}`;
  return (
    <main
      data-testid={form === 'day' ? 'print-day-sheet' : 'print-inhouse'}
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
        <a href="/reports">← отчёты</a>
        <a href={qs('day')} aria-current={form === 'day' ? 'page' : undefined}>
          {T.ru.day}
        </a>
        <a href={qs('inhouse')} aria-current={form === 'inhouse' ? 'page' : undefined}>
          {T.ru.inhouse}
        </a>
        <a href={qs(form, 'ru')}>RU</a>
        <a href={qs(form, 'kz')}>KZ</a>
        <PrintButton />
      </div>
      <h1 style={{ fontSize: 20, textAlign: 'center', margin: '0 0 4px' }}>
        {form === 'day' ? t.day : t.inhouse}
      </h1>
      <div style={{ textAlign: 'center', fontSize: 13, marginBottom: 18 }}>
        {t.property}: <b>{summary.property.name}</b>
        {'; '}
        {t.date}: <b>{ddmmyyyy(date)}</b>
      </div>
      {form === 'day' ? (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <tbody>
              <tr>
                <td style={{ ...cell, width: '38%', color: '#333' }}>{t.arrivals}</td>
                <td style={{ ...cell, fontWeight: 600 }}>{day.counts.arrivals}</td>
              </tr>
              <tr>
                <td style={{ ...cell, color: '#333' }}>{t.departures}</td>
                <td style={{ ...cell, fontWeight: 600 }}>{day.counts.departures}</td>
              </tr>
              <tr>
                <td style={{ ...cell, color: '#333' }}>{t.inHouse}</td>
                <td style={{ ...cell, fontWeight: 600 }}>{day.counts.inHouse}</td>
              </tr>
              <tr>
                <td style={{ ...cell, color: '#333' }}>{t.overdue}</td>
                <td style={{ ...cell, fontWeight: 600 }}>{day.counts.overdueArrivals}</td>
              </tr>
            </tbody>
          </table>
          <Sheet
            title={t.arrivals}
            rows={day.arrivals}
            cols={[t.guest, t.category, t.unit, t.guests]}
            row={(r) => [
              r.guestLabel,
              r.accommodationTypeName,
              r.unitCode ?? '—',
              r.guestsRecorded,
            ]}
            none={t.none}
          />
          <Sheet
            title={t.departures}
            rows={day.departures}
            cols={[t.guest, t.category, t.unit, t.guests]}
            row={(r) => [
              r.guestLabel,
              r.accommodationTypeName,
              r.unitCode ?? '—',
              r.guestsRecorded,
            ]}
            none={t.none}
          />
        </>
      ) : (
        <Sheet
          title={`${t.inHouse}: ${day.counts.inHouse}`}
          rows={day.inHouse}
          cols={[t.guest, t.category, t.unit, t.arrival, t.departure, t.guests]}
          row={(r) => [
            r.guestLabel,
            r.accommodationTypeName,
            r.unitCode ?? '—',
            ddmmyyyy(r.arrivalDate),
            ddmmyyyy(r.departureDate),
            r.guestsRecorded,
          ]}
          none={t.none}
        />
      )}
      <div style={{ fontSize: 11, color: '#555', marginTop: 24 }}>
        {t.printedAt}: {printedAt}
      </div>
    </main>
  );
}

function Sheet({
  title,
  rows,
  cols,
  row,
  none,
}: {
  title: string;
  rows: DeskRow[];
  cols: string[];
  row: (r: DeskRow) => Array<string | number>;
  none: string;
}) {
  return (
    <>
      <h2 style={{ fontSize: 15, margin: '18px 0 6px' }}>{title}</h2>
      {rows.length === 0 ? (
        <p style={{ fontSize: 13, margin: 0 }}>{none}</p>
      ) : (
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
              {cols.map((h) => (
                <th key={h} style={cell}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.itemId} data-testid="print-row">
                {row(r).map((v, i) => (
                  <td key={i} style={cell}>
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

const cell: React.CSSProperties = {
  border: '1px solid #000',
  padding: '5px 8px',
  textAlign: 'left',
  verticalAlign: 'top',
};
