/** «2026-10-12T13:00» в поясе филиала это какой момент */
export function instantOf(local: string, timezone: string): string {
  const naive = Date.parse(`${local}:00Z`);
  if (Number.isNaN(naive)) return '';
  let guess = naive - zoneOffsetMs(new Date(naive), timezone);
  guess = naive - zoneOffsetMs(new Date(guess), timezone);
  return new Date(guess).toISOString();
}

export function clock(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function clockMinutes(value: string): number {
  const [hh, mm] = value.split(':');
  return Number(hh) * 60 + Number(mm);
}

/** Насколько местное время филиала впереди UTC в этот момент */
export function zoneOffsetMs(at: Date, timezone: string): number {
  const parts = new Map(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return (
    Date.UTC(
      Number(parts.get('year')),
      Number(parts.get('month')) - 1,
      Number(parts.get('day')),
      Number(parts.get('hour')),
      Number(parts.get('minute')),
      Number(parts.get('second')),
    ) - at.getTime()
  );
}

/** Момент в вид для `datetime-local` в поясе филиала */
export function localInput(iso: string, timezone: string): string {
  const at = new Date(iso);
  const parts = new Map(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}T${parts.get('hour')}:${parts.get('minute')}`;
}
