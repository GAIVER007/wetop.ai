import { StatusBadge } from '../../components/ui';
import { beautyStatus } from '../../lib/status/beauty';
import { useT } from '../../i18n/locale-provider';

/** Чип статуса: нажатие выбирает статус, повторное нажатие на выбранный снимает отбор */
export function toggleStatus(current: string, clicked: string): string {
  return current === clicked ? '' : clicked;
}

/**
 * Статусы записей чипами-отборами (ТЗ 25.10.2026, п. 11): вместо легенды в «Фильтрах». Тот же отбор `status`, что
 * выбор «Все статусы»; на компьютере строкой под отборами, на телефоне внутри «Фильтров».
 */
export function StatusChips({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useT();
  return (
    <div className="beauty-status-chips" role="group" aria-label={t('Статусы записей')}>
      {Object.keys(beautyStatus)
        .filter((status) => status !== 'CANCELLED')
        .map((status) => (
          <button
            key={status}
            type="button"
            className="beauty-status-chip"
            aria-pressed={value === status}
            onClick={() => onChange(toggleStatus(value, status))}
          >
            <StatusBadge kind="beauty" value={status} />
          </button>
        ))}
    </div>
  );
}
