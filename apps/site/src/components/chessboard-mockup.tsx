import { getDictionary } from '../i18n';

type Tone = 'confirmed' | 'checked-in' | 'new';
type Stay = { from: number; nights: number; tone: Tone; label: string };
type Row = { unit: string; stays: Stay[] };

const DAYS = 7;
const TODAY = 2;

/*
 * Иллюстрация шахматки на HTML/CSS: условные номера, койки и каналы, без дат и гостей. Для скринридера — одна
 * подпись (role="img"), содержимое декоративное.
 */
export function ChessboardMockup() {
  const t = getDictionary().mockup;
  const groups: Array<{ title: string; rows: Row[] }> = [
    {
      title: t.rooms,
      rows: [
        {
          unit: `${t.room} 12`,
          stays: [
            { from: 0, nights: 2, tone: 'checked-in', label: t.checkedIn },
            { from: 3, nights: 4, tone: 'confirmed', label: 'Booking.com' },
          ],
        },
        {
          unit: `${t.room} 14`,
          stays: [{ from: 1, nights: 3, tone: 'confirmed', label: t.fromDesk }],
        },
      ],
    },
    {
      title: t.beds,
      rows: [
        {
          unit: `${t.bed} 5`,
          stays: [{ from: 0, nights: 5, tone: 'confirmed', label: 'Hostelworld' }],
        },
        {
          unit: `${t.bed} 6`,
          stays: [{ from: 0, nights: 3, tone: 'checked-in', label: t.checkedIn }],
        },
        { unit: `${t.bed} 7`, stays: [{ from: 2, nights: 3, tone: 'new', label: 'Booking.com' }] },
      ],
    },
  ];

  return (
    <div className="mockup" role="img" aria-label={t.label}>
      <div className="mockup__window">
        <div className="mockup__toolbar">
          <span className="mockup__dots">
            <i />
            <i />
            <i />
          </span>
          <span className="mockup__title">{t.title}</span>
          <span className="mockup__views">
            {t.views.map((view, index) => (
              <span key={view} className={index === 0 ? 'is-on' : undefined}>
                {view}
              </span>
            ))}
          </span>
        </div>

        <div className="mockup__board">
          <div className="mockup__row mockup__row--head">
            <span className="mockup__unit" />
            {t.weekdays.slice(0, DAYS).map((weekday, index) => (
              <span
                key={weekday}
                className={`mockup__day${index === TODAY ? ' is-today' : ''}`}
                style={{ gridColumn: index + 2 }}
              >
                <small>{weekday}</small>
                {index + 8}
              </span>
            ))}
          </div>

          {groups.map((group) => (
            <div key={group.title} className="mockup__group">
              <div className="mockup__group-title">{group.title}</div>
              {group.rows.map((row) => (
                <div key={row.unit} className="mockup__row">
                  <span className="mockup__unit">{row.unit}</span>
                  {Array.from({ length: DAYS }, (_, index) => (
                    <span
                      key={index}
                      className={`mockup__cell${index === TODAY ? ' is-today' : ''}`}
                      style={{ gridColumn: index + 2 }}
                    />
                  ))}
                  {row.stays.map((stay) => (
                    <span
                      key={`${stay.from}-${stay.label}`}
                      className={`mockup__stay mockup__stay--${stay.tone}`}
                      style={{ gridColumn: `${stay.from + 2} / span ${stay.nights}` }}
                    >
                      {stay.label}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          ))}

          <div className="mockup__unassigned">
            <span className="mockup__unassigned-title">{t.unassigned}: 1</span>
            <span className="mockup__chip">Agoda</span>
          </div>
        </div>
      </div>

      <div className="mockup__toast">
        <span className="mockup__toast-dot" />
        <span>
          <strong>{t.toastTitle}</strong>
          <small>{t.toastText}</small>
        </span>
      </div>
    </div>
  );
}
