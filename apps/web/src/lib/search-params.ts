/** Next search parameters can repeat. Match URLSearchParams.get: the first value wins. */
export type SearchParams = Record<string, string | string[] | undefined>;
export function normalizeSearchParams(params: SearchParams): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
}
