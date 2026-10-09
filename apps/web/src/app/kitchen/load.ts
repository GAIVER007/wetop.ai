import { requireVertical } from '../../lib/vertical-guard';
import { deskShell } from '../../lib/desk-shell';
import { selectedWorkspaceBranch } from '../../lib/workspace-context';
import { menuApi } from '../../lib/food-api';
import { completeFoodList } from '../../lib/food-data';
import type { KitchenWorkspace, MenuCategory, MenuItemView } from '../../lib/food-types';
import { mayAccess } from '../../lib/navigation';

/** Кухня FS1: меню сети и вид текущего филиала (DATA_MODEL §33) */
export async function loadKitchen(): Promise<KitchenWorkspace> {
  const me = await requireVertical(['FOOD_SERVICE']);
  if (me.context?.vertical !== 'FOOD_SERVICE' || !me.context.businessId || !me.context.locationId)
    throw new Error('Выберите ресторан и филиал');
  const [shell, branch] = await Promise.all([deskShell(), selectedWorkspaceBranch()]);
  if (!branch) throw new Error('Выбранный филиал недоступен');
  const [categories, items] = await Promise.all([
    completeFoodList<MenuCategory>(menuApi.categories),
    completeFoodList<MenuItemView>(menuApi.items),
  ]);
  return {
    categories,
    items,
    currency: branch.currency,
    scopeKey: `${me.context.businessId}:${me.context.locationId}`,
    readOnly: shell.readOnly,
    canSettings: mayAccess(shell.access, 'settings'),
  };
}
