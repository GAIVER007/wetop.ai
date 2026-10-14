import { StatusBadge } from '../../components/ui';
import { beautyStatus } from '../../lib/status/beauty';

export function CalendarLegend() {
  return (
    <div className="beauty-calendar-legend" role="group" aria-label="Статусы записей">
      {Object.keys(beautyStatus).map((status) => (
        <StatusBadge key={status} kind="beauty" value={status} />
      ))}
    </div>
  );
}
