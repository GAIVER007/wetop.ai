import type { BadgeTone } from '../../../components/ui';
import type { VoiceSummaryView } from '../../../lib/api';

export type { VoiceSummaryView };

/** Подписи и числа раздела «Голосовой агент»: чистые функции без обращения к API (тестируются отдельно) */
const NO_DATA = 'Нет данных';
const DASH = '–';

export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return DASH;
  const s = Math.floor(seconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  if (hours > 0) return minutes > 0 ? `${hours} ч ${minutes} мин` : `${hours} ч`;
  if (minutes > 0) return rest > 0 ? `${minutes} мин ${rest} с` : `${minutes} мин`;
  return `${rest} с`;
}

/** +7 700 111 22 33 для номеров +7; остальное, включая маски, как есть */
export function formatPhone(value: string): string {
  const match = /^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(value);
  return match ? `+7 ${match[1]} ${match[2]} ${match[3]} ${match[4]}` : value;
}

/** Время звонка в часовом поясе филиала; ошибка в данных не должна ронять страницу */
export function formatWhen(iso: string, timezone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return DASH;
  const parts = (zone: string) =>
    new Intl.DateTimeFormat('ru-RU', {
      timeZone: zone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date);
  try {
    return parts(timezone);
  } catch {
    return parts('UTC');
  }
}

const STATES: Record<string, { label: string; tone: BadgeTone }> = {
  RECEIVED: { label: 'Принят', tone: 'info' },
  ANSWERED: { label: 'Идёт разговор', tone: 'info' },
  ENDED: { label: 'Завершён', tone: 'ok' },
  REJECTED: { label: 'Отклонён', tone: 'warn' },
  FAILED: { label: 'Сбой', tone: 'danger' },
};

export function stateBadge(state: string): { label: string; tone: BadgeTone } {
  return STATES[state] ?? { label: state, tone: 'neutral' };
}

export function callbackStatusLabel(status: 'NEW' | 'DONE'): string {
  return status === 'NEW' ? 'Ждёт звонка' : 'Обработана';
}

export interface SummaryItem {
  key: 'calls' | 'answered' | 'callbacks' | 'transfers' | 'avg' | 'rejected';
  label: string;
  value: string;
}

/** Итоги месяца одной строкой. Журнал пуст: «Нет данных», а не выдуманные нули */
export function summaryItems(view: VoiceSummaryView): SummaryItem[] {
  const t = view.totals;
  const num = (n: number) => (view.hasData ? String(n) : NO_DATA);
  return [
    { key: 'calls', label: 'Звонков', value: num(t.calls) },
    { key: 'answered', label: 'Принято агентом', value: num(t.answered) },
    { key: 'callbacks', label: 'Просьб перезвонить', value: num(t.callbacks) },
    { key: 'transfers', label: 'Переведено на человека', value: num(t.transfers) },
    { key: 'avg', label: 'Средний разговор', value: view.hasData ? formatDuration(t.avgDurationSeconds) : NO_DATA },
    { key: 'rejected', label: 'Отклонено', value: num(t.rejected) },
  ];
}
