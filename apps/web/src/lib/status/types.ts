/**
 * Договор подачи статуса (MV8.5 DS1a, решение владельца №3): слово, тон и, если есть, значок. Общий
 * только договор; каждый домен держит свой реестр рядом (`lib/status/<домен>`), одного большого нет.
 *
 * - `label` одно слово статуса: в бейдже, в карточке, в CSV;
 * - `groupLabel` имя группы во множественном числе: отборы и счётчики («Проживают»);
 * - `short` короткое имя для плашки, где места мало (источник брони на шахматке);
 * - `proper` имя собственное (бренд): внутри фразы не пишется со строчной буквы.
 */
export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface StatusPresentation {
  label: string;
  tone: StatusTone;
  /** имя значка из `components/icon` (строкой: реестр не тянет компонент в модули без JSX) */
  icon?: string;
  groupLabel?: string;
  short?: string;
  proper?: true;
}

export type StatusRegistry<K extends string> = Readonly<Record<K, StatusPresentation>>;

const entry = <K extends string>(registry: StatusRegistry<K>, value: string) =>
  Object.hasOwn(registry, value) ? registry[value as K] : undefined;

/** Слово статуса; неизвестное значение (новый статус API раньше стойки) показывается как есть */
export const statusLabel = <K extends string>(registry: StatusRegistry<K>, value: string): string =>
  entry(registry, value)?.label ?? value;

/** Слово внутри фразы: «бронь не подтверждена». Бренды остаются как есть. */
export function statusText<K extends string>(registry: StatusRegistry<K>, value: string): string {
  const s = entry(registry, value);
  if (!s) return value;
  return s.proper ? s.label : s.label.charAt(0).toLocaleLowerCase('ru') + s.label.slice(1);
}

/** Тон статуса; у неизвестного значения нейтральный */
export const statusTone = <K extends string>(
  registry: StatusRegistry<K>,
  value: string,
): StatusTone => entry(registry, value)?.tone ?? 'neutral';
