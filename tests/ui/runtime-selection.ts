/** Select active servers/projects without creating or changing runtime mirrors. */
export function selectUiRuntimes<T extends { testMatch: string[] }>(
  runtimes: T[],
  count: string | undefined,
): T[] {
  if (count !== undefined && count !== '1' && count !== '2') {
    throw new Error('UI_RUNTIME_WORKERS must be 1 or 2');
  }
  if (runtimes.length !== 2) throw new Error('Expected two runtimes');
  const testMatch = runtimes.flatMap((runtime) => runtime.testMatch);
  if (new Set(testMatch).size !== testMatch.length) {
    throw new Error('Duplicate UI spec in runtime partitions');
  }
  return count === '1' ? [{ ...runtimes[0]!, testMatch }] : runtimes;
}
