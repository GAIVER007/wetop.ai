export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export interface StatusPresentation {
  label: string;
  tone: StatusTone;
  icon?: string;
}

/** Derive legacy string lookups without duplicating labels at consumers. */
export function statusLabels<K extends string>(
  registry: Record<K, StatusPresentation>,
  lowercase = false,
): Record<K, string> & Record<string, string> {
  return Object.fromEntries(
    Object.entries<StatusPresentation>(registry).map(([key, entry]) => [
      key,
      lowercase ? entry.label.toLocaleLowerCase('ru') : entry.label,
    ]),
  ) as Record<K, string> & Record<string, string>;
}

export function badgeTone(tone: StatusTone): 'neutral' | 'info' | 'ok' | 'warn' | 'danger' {
  return tone === 'success' ? 'ok' : tone === 'warning' ? 'warn' : tone;
}
