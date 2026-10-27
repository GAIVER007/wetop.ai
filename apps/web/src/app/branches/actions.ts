'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { branchesApi, ApiError, authApi } from '../../lib/api';
import { SHARED_BRANCH_DESTINATIONS, branchDestination } from '../../lib/branch-destination';
import { parseMembershipRole } from '@pms/domain';
import { startScreen, type WebVertical } from '../../lib/vertical-landing';
import { setScopeCookie } from '../../lib/session';
import { serverT } from '../../i18n/server';

export async function selectBranch(form: FormData) {
  const { items } = await branchesApi.list();
  const branch = items.find((item) => item.id === String(form.get('id')));
  if (!branch) throw new Error('Филиал недоступен. Обновите список.'); // kk-allow: исключение уходит в границу ошибок Next, на экран его текст не выводится
  await setScopeCookie(`business=${branch.location.businessId};location=${branch.locationId}`);
  revalidatePath('/', 'layout');
  // Салону гостиничный онбординг не нужен: у него нет ни объекта, ни номеров (DATA_MODEL §19)
  if (branch.vertical !== 'HOSPITALITY') {
    const destination = branchDestination(String(form.get('returnTo') ?? ''));
    // стартовый экран по роли (владелец 27.10.2026) сразу, без второго перехода через «/»: лишний переход
    // перерисовывал страницу под щелчком в выборе филиала
    const role = await authApi
      .me()
      .then((me) => (me.user?.role && parseMembershipRole(me.user.role)) || null)
      .catch(() => null);
    redirect(
      SHARED_BRANCH_DESTINATIONS.has(destination)
        ? destination
        : startScreen(branch.vertical as WebVertical, role),
    );
  }
  const destination = branchDestination(String(form.get('returnTo') ?? ''));
  redirect(
    branch._count.inventoryUnits || destination === '/hotel-settings' || destination === '/marketing/site/editor'
      ? destination
      : '/onboarding',
  );
}
export async function createBranch(
  _prev: { error?: string; message?: string } | null,
  form: FormData,
) {
  try {
    const vertical =
      form.get('vertical') === 'FOOD_SERVICE'
        ? 'FOOD_SERVICE'
        : form.get('vertical') === 'BEAUTY'
          ? 'BEAUTY'
          : 'HOSPITALITY';
    const businessId = String(form.get('businessId') ?? '');
    const isNew = form.get('mode') === 'BUSINESS';
    const businessName = String(form.get('businessName') ?? '').trim();
    await branchesApi.create({
      id: String(form.get('id')),
      name: String(form.get('name') ?? '').trim() || (isNew ? businessName : ''),
      address: String(form.get('address') ?? ''),
      currency: String(form.get('currency') ?? ''),
      timezone: String(form.get('timezone') ?? ''),
      vertical,
      ...(businessId ? { businessId } : {}),
      ...(isNew ? { businessName, newBusinessId: String(form.get('newBusinessId') ?? '') } : {}),
    });
    revalidatePath('/branches');
    revalidatePath('/platform');
    const t = await serverT();
    return {
      message:
        vertical === 'FOOD_SERVICE'
          ? t('Ресторан создан. Откройте его, чтобы настроить зал и меню.')
          : vertical === 'BEAUTY'
            ? t('Салон создан. Откройте его, чтобы увидеть, что в нём уже работает.')
            : t('Филиал создан. Откройте его, чтобы добавить категории и номера.'),
    };
  } catch (e) {
    const t = await serverT();
    return {
      error:
        e instanceof ApiError ? e.message : t('Не удалось сохранить. Обновите список перед повтором.'),
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
    const currentId = selected?.id ?? null;
    return {
      items: items.map(({ id, name, address, vertical }) => ({ id, name, address, vertical })),
      currentId,
    };
  } catch {
    const t = await serverT();
    return { error: t('Не удалось загрузить филиалы. Попробуйте ещё раз.') };
  }
}

export async function saveBusinessCard(form: FormData) {
  const { businessCardsApi } = await import('../../lib/api');
  const id = String(form.get('businessId') ?? '');
  const payload = new FormData();
  for (const key of ['name', 'description', 'expectedUpdatedAt', 'removeCover', 'file']) {
    const value = form.get(key);
    if (value !== null) payload.append(key, value);
  }
  try {
    const business = await businessCardsApi.save(id, payload);
    revalidatePath('/branches');
    return { business };
  } catch (error) {
    const t = await serverT();
    return {
      error:
        error instanceof ApiError
          ? error.message
          : t('Не удалось сохранить карточку. Повторите попытку.'),
    };
  }
}

export async function archiveBranch(form: FormData) {
  try {
    const { branchLifecycleApi } = await import('../../lib/api');
    await branchLifecycleApi.archive(String(form.get('locationId')));
    const { clearScopeCookie } = await import('../../lib/session');
    await clearScopeCookie();
    revalidatePath('/', 'layout');
    revalidatePath('/branches');
    return {};
  } catch (error) {
    const t = await serverT();
    return { error: error instanceof ApiError ? error.message : t('Не удалось архивировать объект.') };
  }
}
export async function restoreBranch(form: FormData) {
  try {
    const { branchLifecycleApi } = await import('../../lib/api');
    await branchLifecycleApi.restore(String(form.get('locationId')));
    revalidatePath('/', 'layout');
    revalidatePath('/branches');
    return {};
  } catch (error) {
    const t = await serverT();
    return { error: error instanceof ApiError ? error.message : t('Не удалось восстановить объект.') };
  }
}
