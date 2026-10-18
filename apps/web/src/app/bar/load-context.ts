import { cache } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { ApiError, barApi } from '../../lib/api';
import { currentMe } from '../../lib/desk-shell';
import { hotelApi } from '../../lib/hotel-api';
import { selectedWorkspaceBranch } from '../../lib/workspace-context';
import type { BarFormContext } from './context';

/**
 * Объект и валюта денежных форм бара (D-CUR). Бар общий модуль филиала (ADR-178): у гостиницы объект и валюта
 * берутся из её настроек, у салона гостиничного объекта нет (настройки отвечают 404), тогда объектом формы
 * служит сам выбранный филиал, а валютой валюта бара из его отчёта. Любой другой отказ не прячется.
 */
export const loadBarContext = cache(async (): Promise<BarFormContext> => {
  const me = await currentMe();
  if (me.context?.vertical === 'BEAUTY' || me.context?.vertical === 'FOOD_SERVICE') {
    const branch = await selectedWorkspaceBranch();
    if (!me.context.locationId || branch?.locationId !== me.context.locationId || !branch.currency)
      throw new ApiError(409, 'Сначала выберите филиал');
    return { propertyId: me.context.locationId, currency: branch.currency };
  }
  try {
    const { property } = await hotelApi.settings();
    return { propertyId: property.id, currency: property.currency };
  } catch (error) {
    unstable_rethrow(error);
    if (!(error instanceof ApiError) || error.status !== 404) throw error;
  }
  const report = await barApi.report();
  return { propertyId: me.context?.locationId ?? '', currency: report.currency };
});
