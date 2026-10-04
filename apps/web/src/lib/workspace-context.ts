import { cache } from 'react';
import { currentMe, deskShell } from './desk-shell';
import { branchesApi } from './api';
import { propertyTimezone } from './hotel-api';
import { FALLBACK_TIMEZONE } from './property-time';

export const selectedBeautyBranch = cache(async () => {
  const { context } = await currentMe();
  if (context?.vertical !== 'BEAUTY' || !context.businessId || !context.locationId) return null;
  const { items } = await branchesApi.list();
  return (
    items.find(
      (item) =>
        item.locationId === context.locationId && item.location.businessId === context.businessId,
    ) ?? null
  );
});

export async function workspaceTimezone() {
  if ((await deskShell()).vertical === 'BEAUTY')
    return (await selectedBeautyBranch())?.timezone ?? FALLBACK_TIMEZONE;
  return propertyTimezone();
}
