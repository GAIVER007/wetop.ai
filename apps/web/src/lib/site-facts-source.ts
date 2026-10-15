import { unstable_rethrow } from 'next/navigation';
import { beautyApi, branchesApi, inventoryEditorApi, marketingSiteApi, siteAssetsApi, siteEditorApi } from './api';
import { restaurantApi, foodApi } from './food-api';
import { completeFoodList } from './food-data';
import type { MenuCategory, MenuItemView, ServicePeriod } from './food-types';
import type { SiteFactsSource } from './site-facts';

/**
 * Настоящие запросы стойки для `loadSiteFacts` (SITE-1). Только чтение и только в строгом scope выбранного филиала.
 * Управление Next (переход на вход и т. п.) пропускается дальше, остальные сбои решает `loadSiteFacts`.
 */
const pass = <T>(load: () => Promise<T>) => async () => {
  try {
    return await load();
  } catch (e) {
    unstable_rethrow(e);
    throw e;
  }
};

/** Мастеров в общей неделе не больше этого: график читается по одному мастеру */
const WEEK_EMPLOYEES = 12;

export function siteFactsSource(currentLocationId: string | null): SiteFactsSource {
  return {
    facts: (id: string) => pass(() => marketingSiteApi.facts(id))(),
    locations: pass(() => marketingSiteApi.locations()),
    hospitality: {
      brief: pass(() => siteEditorApi.brief()),
      prices: pass(async () => (await inventoryEditorApi.categories()).filter((c) => c.active).map((c) => ({ code: c.code, priceMinor: c.priceMinor }))),
      photos: pass(async () => (await siteAssetsApi.list()).assets.filter((a) => a.kind === 'IMAGE').length),
    },
    beauty: {
      services: pass(() => beautyApi.services()),
      employees: pass(() => beautyApi.employees()),
      // общая неделя филиала: на каждый день самое раннее начало и самый поздний конец среди мастеров
      hours: pass(async () => {
        const first = await beautyApi.schedule();
        const ids = first.employees.filter((e) => e.active && e.worksHere).map((e) => e.id).slice(0, WEEK_EMPLOYEES);
        const weeks = await Promise.all(ids.map((id) => (id === first.employee?.id ? Promise.resolve(first) : beautyApi.schedule(id)).then((s) => s.week)));
        const byDay = new Map<number, { timeFrom: string; timeTo: string }>();
        for (const day of weeks.flat())
          for (const i of day.intervals) {
            const was = byDay.get(day.weekday);
            byDay.set(day.weekday, {
              timeFrom: !was || i.timeFrom < was.timeFrom ? i.timeFrom : was.timeFrom,
              timeTo: !was || i.timeTo > was.timeTo ? i.timeTo : was.timeTo,
            });
          }
        return [...byDay].map(([weekday, i]) => ({ weekday, intervals: [i] }));
      }),
    },
    food: {
      categories: pass(() => completeFoodList<MenuCategory>(restaurantApi.categories)),
      items: pass(() => completeFoodList<MenuItemView>(restaurantApi.menuItems)),
      periods: pass(() => completeFoodList<ServicePeriod>(foodApi.periods)),
    },
    branch: pass(async () => {
      const { items } = await branchesApi.list();
      const own = items.find((b) => b.locationId === currentLocationId);
      return own ? { name: own.name, address: own.address } : null;
    }),
  };
}
