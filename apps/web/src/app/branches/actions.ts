'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { branchesApi, ApiError } from '../../lib/api';
import { SCOPE_COOKIE } from '../../lib/scope-pointer';

export async function selectBranch(form: FormData) {
  const { items } = await branchesApi.list();
  const branch = items.find((item) => item.id === String(form.get('id')));
  if (!branch) throw new Error('Филиал недоступен. Обновите список.');
  (await cookies()).set(
    SCOPE_COOKIE,
    `business=${branch.location.businessId};location=${branch.locationId}`,
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    },
  );
  revalidatePath('/', 'layout');
  redirect(branch._count.inventoryUnits ? '/today' : '/onboarding');
}
export async function createBranch(
  _prev: { error?: string; message?: string } | null,
  form: FormData,
) {
  try {
    await branchesApi.create({
      id: String(form.get('id')),
      name: String(form.get('name') ?? ''),
      address: String(form.get('address') ?? ''),
      currency: String(form.get('currency') ?? ''),
      timezone: String(form.get('timezone') ?? ''),
    });
    revalidatePath('/branches');
    revalidatePath('/platform');
    return { message: 'Филиал создан. Откройте его, чтобы добавить категории и номера.' };
  } catch (e) {
    return {
      error:
        e instanceof ApiError ? e.message : 'Не удалось сохранить. Обновите список перед повтором.',
    };
  }
}
