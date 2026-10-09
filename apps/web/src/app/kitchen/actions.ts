'use server';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { ApiError } from '../../lib/api';
import { currentMe } from '../../lib/desk-shell';
import { menuApi } from '../../lib/food-api';
import type {
  MenuCategoryInput,
  MenuItemInput,
  MenuLocationInput,
} from '../../lib/food-types';

type MenuCommand =
  | { kind: 'category'; id?: string; body: MenuCategoryInput }
  | { kind: 'item'; id?: string; body: MenuItemInput }
  | { kind: 'location'; id: string; body: MenuLocationInput };

async function scope(key: string) {
  const { context } = await currentMe();
  if (
    context?.vertical !== 'FOOD_SERVICE' ||
    !context.businessId ||
    !context.locationId ||
    key !== `${context.businessId}:${context.locationId}`
  )
    throw new ApiError(409, 'Выбран другой ресторан. Откройте форму заново.');
}

export async function saveMenu(scopeKey: string, command: MenuCommand) {
  try {
    await scope(scopeKey);
    if (command.kind === 'category') {
      if (command.id) await menuApi.updateCategory(command.id, command.body);
      else await menuApi.createCategory(command.body);
    }
    if (command.kind === 'item') {
      if (command.id) await menuApi.updateItem(command.id, command.body);
      else await menuApi.createItem(command.body);
    }
    if (command.kind === 'location') await menuApi.setItemLocation(command.id, command.body);
    revalidatePath('/kitchen');
    return { error: null };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof Error ? error.message : 'Не удалось сохранить. Повторите действие.',
    };
  }
}
