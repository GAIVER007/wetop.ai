/** Only bounded counters from the internal bot response may enter the event log. */
export function wizardUsage(value: unknown) {
  if (!value || typeof value !== 'object') return { complete: false };
  const v = value as Record<string, unknown>;
  const { input, output, paidCalls } = v;
  if (![input, output, paidCalls].every((n) => Number.isSafeInteger(n) && (n as number) >= 0))
    return { complete: false };
  return {
    input: input as number,
    output: output as number,
    paidCalls: paidCalls as number,
    complete: v.complete === true,
  };
}
