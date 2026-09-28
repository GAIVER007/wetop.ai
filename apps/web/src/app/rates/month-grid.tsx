import type { RateCalendarDay } from '../../lib/api';
import { displayDate } from '../../lib/display-date';
import { pluralRu } from '../../lib/plural';
import { cx } from '../../components/ui';
import { PriceCell } from './price-cell';

const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const WEEK = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const nights = (n: number) => pluralRu(n, ['ночь', 'ночи', 'ночей']);
/** Родительный падеж после «до»: до 1 ночи, до 5 ночей, до 21 ночи */
const maxNights = (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'ночи' : 'ночей'}`;

/**
 * Сетка месяца (ТЗ v2 §6–§8, §21–§24, ADR-111): главное в ячейке — цена за полную вместимость,
 * цена за меньшее число гостей — мельче со словом; ограничения — словами внизу; выходные — лёгкий
 * фон, сегодня — рамка акцента. Правка цены — прежний `PriceCell` (срез 7.2). На телефоне сетка
 * складывается в список дней — разметка та же, складывает CSS (`rates.css`). С RT2 число дня — кнопка
 * выбора даты (`aria-pressed`); выбор держит `RatesCalendar`.
 */
export function MonthGrid({
  days,
  currency,
  capacityAdults,
  category,
  ratePlan,
  today,
  selection,
  onPick,
}: {
  days: RateCalendarDay[];
  currency: string;
  capacityAdults: number;
  category: string;
  ratePlan: string;
  today: string;
  selection: { from: string; to: string } | null;
  onPick: (date: string) => void;
}) {
  const first = days[0]!;
  const lead = (new Date(`${first.date}T00:00:00Z`).getUTCDay() + 6) % 7;
  const tail = (7 - ((lead + days.length) % 7)) % 7;
  // полная вместимость — цена продажи (её же Channex получает основной), меньшие — строкой мельче
  const others = Array.from({ length: capacityAdults - 1 }, (_, i) => i + 1);
  return (
    <div className="rate-cal" data-testid="rates-calendar">
      <div className="rate-cal__weekdays" aria-hidden>
        {WEEK.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <ol className="rate-cal__grid">
        {Array.from({ length: lead }, (_, i) => (
          <li key={`lead-${i}`} className="rate-cal__void" aria-hidden />
        ))}
        {days.map((d) => {
          const wd = new Date(`${d.date}T00:00:00Z`).getUTCDay();
          const weekend = wd === 0 || wd === 6;
          const restrictions = [
            d.closedToArrival ? 'закрыт заезд' : '',
            d.closedToDeparture ? 'закрыт выезд' : '',
            // «мин. 1» ничего не ограничивает и на 30 ячейках был бы шумом (план §4); в форме правки значение видно
            d.minStay != null && d.minStay >= 2 ? `мин. ${nights(d.minStay)}` : '',
            d.maxStay != null ? `до ${maxNights(d.maxStay)}` : '',
          ].filter(Boolean);
          const selected = !!selection && d.date >= selection.from && d.date <= selection.to;
          return (
            <li
              key={d.date}
              data-testid={`rate-row-${d.date}`}
              className={cx(
                'rate-cal__day',
                d.stopSell && 'is-stop',
                !d.stopSell && weekend && 'is-weekend',
                d.date === today && 'is-today',
                selected && 'is-selected',
              )}
            >
              <button
                type="button"
                className="rate-cal__pick"
                aria-pressed={selected}
                aria-label={`Выбрать ${displayDate(d.date)} ${WD[wd]}`}
                onClick={() => onPick(d.date)}
              >
                <time dateTime={d.date} className="rate-cal__date">
                  <span className="rate-cal__num" aria-hidden>
                    {Number(d.date.slice(8, 10))}
                  </span>
                  <span className="rate-cal__full">
                    {displayDate(d.date)} {WD[wd]}
                  </span>
                </time>
                {selected && (
                  <span className="rate-cal__check" aria-hidden>
                    ✓
                  </span>
                )}
              </button>
              <div className="rate-cal__price" data-testid={`price-${d.date}-${capacityAdults}`}>
                {capacityAdults > 1 && (
                  <span className="rate-cal__word">
                    {pluralRu(capacityAdults, ['гость', 'гостя', 'гостей'])}
                  </span>
                )}
                <PriceCell
                  date={d.date}
                  occupancy={capacityAdults}
                  minor={d.prices[String(capacityAdults)] ?? null}
                  currency={currency}
                  accommodationTypeCode={category}
                  ratePlanCode={ratePlan}
                />
              </div>
              {others.map((occ) => (
                <div
                  key={occ}
                  className="rate-cal__price rate-cal__price--secondary"
                  data-testid={`price-${d.date}-${occ}`}
                >
                  <span className="rate-cal__word">
                    {pluralRu(occ, ['гость', 'гостя', 'гостей'])}
                  </span>
                  <PriceCell
                    date={d.date}
                    occupancy={occ}
                    minor={d.prices[String(occ)] ?? null}
                    currency={currency}
                    accommodationTypeCode={category}
                    ratePlanCode={ratePlan}
                  />
                </div>
              ))}
              {(d.stopSell || restrictions.length > 0) && (
                <div className="rate-cal__limits">
                  {d.stopSell && <span className="rate-cal__stop">закрыто (стоп-продажа)</span>}
                  {restrictions.map((r) => (
                    <span key={r}>{r}</span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
        {Array.from({ length: tail }, (_, i) => (
          <li key={`tail-${i}`} className="rate-cal__void" aria-hidden />
        ))}
      </ol>
    </div>
  );
}
