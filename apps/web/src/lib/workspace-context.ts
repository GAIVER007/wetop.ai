import { cache } from 'react';
import { currentMe, deskShell } from './desk-shell';
import { branchesApi } from './api';
import { propertyTimezone } from './hotel-api';
import { FALLBACK_TIMEZONE } from './property-time';

export const selectedWorkspaceBranch = cache(async () => {
  const { context } = await currentMe();
  if (
    !context ||
    !['BEAUTY', 'FOOD_SERVICE'].includes(context?.vertical ?? '') ||
    !context.businessId ||
    !context.locationId
  )
    return null;
  const { items } = await branchesApi.list();
  return (
    items.find(
      (item) =>
        item.locationId === context.locationId && item.location.businessId === context.businessId,
    ) ?? null
  );
});

export async function workspaceTimezone() {
  const shell = await deskShell();
  if (shell.access.unknown) return FALLBACK_TIMEZONE;
  if (shell.vertical !== 'HOSPITALITY')
    return (await selectedWorkspaceBranch())?.timezone ?? FALLBACK_TIMEZONE;
  return propertyTimezone();
}
