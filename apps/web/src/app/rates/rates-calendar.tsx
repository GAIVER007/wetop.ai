'use client';
import { useState } from 'react';
import type { RateCalendarDay } from '../../lib/api';
import { Button } from '../../components/ui';
import { MonthGrid } from './month-grid';
import { RangeDrawer, periodOf, selectedText } from './range-drawer';
import { orderedRange, pricesInRange } from './range-summary';

/**
 * Календарь цен с выбором дат (RT2, ADR-111, план §8). Касание дня выбирает его, касание другого — отрезок,
 * третье — новый выбор, касание того же дня снимает выбор; мышь, палец и клавиатура идут одним путём —
 * кнопкой с числом дня. Выбор живёт в пределах показанного месяца: страница пересоздаёт календарь ключом,
 * когда меняются месяц, категория или тариф.
 */
export function RatesCalendar(props: {
  days: RateCalendarDay[];
  currency: string;
  capacityAdults: number;
  category: string;
  ratePlan: string;
  categoryName: string;
  planName: string;
  today: string;
  readOnly: boolean;
}) {
  const [anchor, setAnchor] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const range = anchor ? orderedRange(anchor, end) : null;
  const selectedDays = range ? pricesInRange(props.days, range.from, range.to) : [];
  const clear = () => {
    setAnchor(null);
    setEnd(null);
  };
  const pick = (date: string) => {
    if (anchor && end === null) {
      if (date === anchor) clear();
      else setEnd(date);
      return;
    }
    setAnchor(date);
    setEnd(null);
  };
  return (
    <>
      <div className="rates-selection" data-testid="rates-selection">
        {range ? (
          <>
            <p className="rates-selection__text" aria-live="polite">
              {selectedText(selectedDays.length)}: {periodOf(range.from, range.to)}
            </p>
            <div className="rates-selection__actions">
              <Button type="button" onClick={() => setOpen(true)}>
                Изменить цены
              </Button>
              <Button type="button" tone="ghost" onClick={clear}>
                Сбросить выбор
              </Button>
            </div>
          </>
        ) : (
          <p className="rates-selection__hint" aria-live="polite">
            Выберите дату или отрезок в календаре, чтобы изменить цены
          </p>
        )}
      </div>
      <MonthGrid
        days={props.days}
        currency={props.currency}
        capacityAdults={props.capacityAdults}
        category={props.category}
        ratePlan={props.ratePlan}
        today={props.today}
        selection={range}
        onPick={pick}
      />
      {open && range && (
        <RangeDrawer
          days={selectedDays}
          from={range.from}
          to={range.to}
          capacityAdults={props.capacityAdults}
          currency={props.currency}
          category={props.category}
          ratePlan={props.ratePlan}
          categoryName={props.categoryName}
          planName={props.planName}
          readOnly={props.readOnly}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            clear();
          }}
        />
      )}
    </>
  );
}
