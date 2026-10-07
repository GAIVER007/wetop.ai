'use server';
import { landingForVertical } from '../../lib/vertical-landing';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { branchesApi, ApiError, authApi } from '../../lib/api';
import { branchDestination } from '../../lib/branch-destination';
import { hotelApi } from '../../lib/hotel-api';
import { setScopeCookie } from '../../lib/session';

export async function selectBranch(form: FormData) {
  const { items } = await branchesApi.list();
  const branch = items.find((item) => item.id === String(form.get('id')));
  if (!branch) throw new Error('Филиал недоступен. Обновите список.');
  await setScopeCookie(`business=${branch.location.businessId};location=${branch.locationId}`);
  revalidatePath('/', 'layout');
  // Салону гостиничный онбординг не нужен: у него нет ни объекта, ни номеров (DATA_MODEL §19)
  if (branch.vertical !== 'HOSPITALITY') {
    const destination = branchDestination(String(form.get('returnTo') ?? ''));
    redirect(destination === '/management/analytics' ? destination : landingForVertical(branch.vertical));
  }
  redirect(
    branch._count.inventoryUnits
      ? branchDestination(String(form.get('returnTo') ?? ''))
      : '/onboarding',
  );
}
export async function createBranch(
  _prev: { error?: string; message?: string } | null,
  form: FormData,
) {
  try {
    const vertical = form.get('vertical') === 'BEAUTY' ? 'BEAUTY' : 'HOSPITALITY';
    await branchesApi.create({
      id: String(form.get('id')),
      name: String(form.get('name') ?? ''),
      address: String(form.get('address') ?? ''),
      currency: String(form.get('currency') ?? ''),
      timezone: String(form.get('timezone') ?? ''),
      vertical,
    });
    revalidatePath('/branches');
    revalidatePath('/platform');
    return {
      message:
        vertical === 'BEAUTY'
          ? 'Салон создан. Откройте его, чтобы увидеть, что в нём уже работает.'
          : 'Филиал создан. Откройте его, чтобы добавить категории и номера.',
    };
  } catch (e) {
    return {
      error:
        e instanceof ApiError ? e.message : 'Не удалось сохранить. Обновите список перед повтором.',
    };
  }
}

export async function branchChoices() {
  try {
    const [{ items }, me] = await Promise.all([branchesApi.list(), authApi.me()]);
    const selected = items.find(
      (item) =>
        item.locationId === me.context?.locationId &&
        item.location.businessId === me.context?.businessId,
    );
    const currentId =
      selected?.id ?? (me.context?.businessId ? null : (await hotelApi.settings()).property.id);
    return {
      items: items.map(({ id, name, address }) => ({ id, name, address })),
      currentId,
    };
  } catch {
    return { error: 'Не удалось загрузить филиалы. Попробуйте ещё раз.' };
  }
}
