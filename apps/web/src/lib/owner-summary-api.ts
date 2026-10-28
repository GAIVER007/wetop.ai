import { getJsonPublic } from './api';
import type { OwnerPeriod, OwnerSummaryDto } from './owner-summary';
/** Existing transport supplies session and verified scope, no fallback on API failure. */
export async function readOwnerSummary(period: OwnerPeriod): Promise<OwnerSummaryDto> {
  return getJsonPublic<OwnerSummaryDto>(`/owner-summary?period=${encodeURIComponent(period)}`);
}
