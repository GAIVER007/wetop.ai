/** Calendar dates only. Dropping on a day includes that night; departure is the following day. */
export function extensionNights(lastNight: string, targetNight: string): number {
  const ordinal = (date: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NaN;
    const value = Date.parse(`${date}T12:00:00Z`);
    return Number.isFinite(value) && new Date(value).toISOString().slice(0, 10) === date
      ? value / 86_400_000
      : NaN;
  };
  const nights = ordinal(targetNight) - ordinal(lastNight);
  return Number.isInteger(nights) && nights > 0 && nights <= 30 ? nights : 0;
}
