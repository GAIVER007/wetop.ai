'use client';
import { DateRangePopover } from './date-range-popover';
import { Icon } from './icon';

/**
 * Переход по дням в шапке журнала (единая шапка 23.10.2026, образец календарь гостиницы): одна рамка с кнопкой дня
 * (то же окно выбора, что период календаря гостиницы, щелчок по дню сразу переходит) и стрелками ‹ ›. Один на салон
 * и ресторан; адрес дня держит экран.
 */
export function DayNav({
  date,
  today,
  onGo,
  presets,
  testId,
}: {
  date: string;
  today: string;
  onGo: (date: string) => void;
  /** быстрые дни в окне; по умолчанию «Сегодня», «Завтра» */
  presets?: Array<{ label: string; date?: string; onSelect?: () => void }>;
  testId?: string;
}) {
  const shift = (n: number) => {
    const at = new Date(`${date}T12:00:00Z`);
    at.setUTCDate(at.getUTCDate() + n);
    return at.toISOString().slice(0, 10);
  };
  const tomorrow = (() => {
    const at = new Date(`${today}T12:00:00Z`);
    at.setUTCDate(at.getUTCDate() + 1);
    return at.toISOString().slice(0, 10);
  })();
  return (
    <div className="board-period day-nav" role="group" aria-label="День журнала" data-testid={testId}>
      <DateRangePopover
        from={date}
        to={date}
        today={today}
        compact
        onDay={onGo}
        dayPresets={
          presets ?? [
            { label: 'Сегодня', date: today },
            { label: 'Завтра', date: tomorrow },
          ]
        }
        triggerTestId="day-nav-button"
      />
      <button type="button" className="icon-button" aria-label="Предыдущий день" onClick={() => onGo(shift(-1))}>
        <Icon name="chevron" className="rotate-left" />
      </button>
      <button type="button" className="icon-button" aria-label="Следующий день" onClick={() => onGo(shift(1))}>
        <Icon name="chevron" />
      </button>
    </div>
  );
}
