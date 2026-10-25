import { StatusBadge } from '../../components/ui';
import { beautyStatus } from '../../lib/status/beauty';
import { useT } from '../../i18n/locale-provider';

export function CalendarLegend() {
  const t = useT();
  return (
    <div className="beauty-calendar-legend" role="group" aria-label={t('Статусы записей')}>
      {Object.keys(beautyStatus).map((status) => (
        <StatusBadge key={status} kind="beauty" value={status} />
      ))}
    </div>
  );
}
